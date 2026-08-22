use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::time::timeout;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArchiveProbeFailure {
    AbsentOrConflicting,
    Unreachable,
    Unusable,
    TimedOut,
}

#[derive(Debug, Clone)]
pub struct ArchiveRootProbe {
    pub root: PathBuf,
}

impl ArchiveRootProbe {
    pub async fn run(
        root: impl AsRef<Path>,
        limit: Duration,
    ) -> Result<PathBuf, ArchiveProbeFailure> {
        Self::run_with_port(root, limit, RealArchiveProbePort).await
    }

    async fn run_with_port<P>(
        root: impl AsRef<Path>,
        limit: Duration,
        port: P,
    ) -> Result<PathBuf, ArchiveProbeFailure>
    where
        P: ArchiveProbePort,
    {
        let root = root.as_ref().to_path_buf();
        if root.as_os_str().is_empty() {
            return Err(ArchiveProbeFailure::AbsentOrConflicting);
        }
        let task_root = root.clone();
        let task = tokio::task::spawn_blocking(move || {
            port.before_root(&task_root)?;
            std::fs::create_dir_all(&task_root).map_err(|_| ArchiveProbeFailure::Unreachable)?;
            let name = format!(".convexa-probe-{}", uuid_bytes());
            let path = task_root.join(name);
            let cleanup = SentinelCleanup(path.clone());
            let data = b"convexa archive probe v1";
            port.before_create(&path)?;
            let mut f = std::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .map_err(|_| ArchiveProbeFailure::Unusable)?;
            use std::io::Write;
            f.write_all(data)
                .map_err(|_| ArchiveProbeFailure::Unusable)?;
            port.before_flush(&path)?;
            f.sync_all().map_err(|_| ArchiveProbeFailure::Unusable)?;
            drop(f);
            #[cfg(unix)]
            std::fs::File::open(&task_root)
                .and_then(|directory| directory.sync_all())
                .map_err(|_| ArchiveProbeFailure::Unusable)?;
            port.before_read(&path)?;
            let got = std::fs::read(&path).map_err(|_| ArchiveProbeFailure::Unusable)?;
            if got != data {
                return Err(ArchiveProbeFailure::Unusable);
            }
            std::fs::remove_file(&path).map_err(|_| ArchiveProbeFailure::Unusable)?;
            std::mem::forget(cleanup);
            Ok(task_root)
        });
        timeout(limit, task)
            .await
            .map_err(|_| ArchiveProbeFailure::TimedOut)?
            .map_err(|_| ArchiveProbeFailure::Unusable)?
    }
}

trait ArchiveProbePort: Send + 'static {
    fn before_root(&self, _root: &Path) -> Result<(), ArchiveProbeFailure> {
        Ok(())
    }
    fn before_create(&self, _sentinel: &Path) -> Result<(), ArchiveProbeFailure> {
        Ok(())
    }
    fn before_flush(&self, _sentinel: &Path) -> Result<(), ArchiveProbeFailure> {
        Ok(())
    }
    fn before_read(&self, _sentinel: &Path) -> Result<(), ArchiveProbeFailure> {
        Ok(())
    }
}

struct RealArchiveProbePort;
impl ArchiveProbePort for RealArchiveProbePort {}

struct SentinelCleanup(PathBuf);

impl Drop for SentinelCleanup {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.0);
    }
}

fn uuid_bytes() -> String {
    use rand::RngCore;
    let mut b = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut b);
    hex::encode(b)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex};

    #[derive(Clone, Copy)]
    enum InjectedFault {
        ReadOnly,
        NonFlushable,
        Readback,
        Timed,
    }

    struct FaultPort {
        fault: InjectedFault,
        sentinel: Arc<Mutex<Option<PathBuf>>>,
    }

    impl ArchiveProbePort for FaultPort {
        fn before_create(&self, sentinel: &Path) -> Result<(), ArchiveProbeFailure> {
            *self.sentinel.lock().unwrap() = Some(sentinel.to_path_buf());
            if matches!(self.fault, InjectedFault::ReadOnly) {
                return Err(ArchiveProbeFailure::Unreachable);
            }
            if matches!(self.fault, InjectedFault::Timed) {
                std::thread::sleep(Duration::from_millis(100));
            }
            Ok(())
        }

        fn before_flush(&self, _sentinel: &Path) -> Result<(), ArchiveProbeFailure> {
            if matches!(self.fault, InjectedFault::NonFlushable) {
                return Err(ArchiveProbeFailure::Unusable);
            }
            Ok(())
        }

        fn before_read(&self, sentinel: &Path) -> Result<(), ArchiveProbeFailure> {
            if matches!(self.fault, InjectedFault::Readback) {
                std::fs::remove_file(sentinel).unwrap();
            }
            Ok(())
        }
    }
    #[tokio::test]
    async fn probe_flushes_and_cleans_sentinel() {
        let root = std::env::temp_dir().join(format!("convexa-archive-probe-{}", uuid_bytes()));
        let result = ArchiveRootProbe::run(&root, Duration::from_secs(2))
            .await
            .unwrap();
        assert_eq!(result, root);
        assert!(std::fs::read_dir(&root).unwrap().next().is_none());
        let _ = std::fs::remove_dir(&root);
    }

    #[tokio::test]
    async fn probe_failure_matrix_is_closed_and_value_free() {
        assert_eq!(
            ArchiveRootProbe::run(PathBuf::new(), Duration::from_secs(1)).await,
            Err(ArchiveProbeFailure::AbsentOrConflicting)
        );
        let parent = std::env::temp_dir().join(format!("convexa-archive-file-{}", uuid_bytes()));
        std::fs::write(&parent, b"not a directory").unwrap();
        assert!(matches!(
            ArchiveRootProbe::run(parent.clone(), Duration::from_secs(1)).await,
            Err(ArchiveProbeFailure::Unreachable | ArchiveProbeFailure::Unusable)
        ));
        let _ = std::fs::remove_file(parent);

        let timeout_root =
            std::env::temp_dir().join(format!("convexa-archive-timeout-{}", uuid_bytes()));
        assert_eq!(
            ArchiveRootProbe::run(&timeout_root, Duration::ZERO).await,
            Err(ArchiveProbeFailure::TimedOut)
        );
        tokio::time::sleep(Duration::from_millis(100)).await;
        if timeout_root.exists() {
            assert!(std::fs::read_dir(&timeout_root).unwrap().next().is_none());
            let _ = std::fs::remove_dir(timeout_root);
        }
    }

    #[tokio::test]
    async fn injected_read_only_non_flushable_readback_and_timeout_faults_cleanup() {
        for (fault, expected) in [
            (InjectedFault::ReadOnly, ArchiveProbeFailure::Unreachable),
            (InjectedFault::NonFlushable, ArchiveProbeFailure::Unusable),
            (InjectedFault::Readback, ArchiveProbeFailure::Unusable),
        ] {
            let root = std::env::temp_dir().join(format!("convexa-archive-fault-{}", uuid_bytes()));
            let sentinel = Arc::new(Mutex::new(None));
            let result = ArchiveRootProbe::run_with_port(
                &root,
                Duration::from_secs(2),
                FaultPort {
                    fault,
                    sentinel: Arc::clone(&sentinel),
                },
            )
            .await;
            assert_eq!(result, Err(expected));
            if let Some(path) = sentinel.lock().unwrap().as_ref() {
                assert!(!path.exists(), "failure must remove its sentinel: {path:?}");
            }
            let _ = std::fs::remove_dir(&root);
        }

        let root = std::env::temp_dir().join(format!("convexa-archive-time-port-{}", uuid_bytes()));
        let sentinel = Arc::new(Mutex::new(None));
        let result = ArchiveRootProbe::run_with_port(
            &root,
            Duration::from_millis(10),
            FaultPort {
                fault: InjectedFault::Timed,
                sentinel: Arc::clone(&sentinel),
            },
        )
        .await;
        assert_eq!(result, Err(ArchiveProbeFailure::TimedOut));
        tokio::time::sleep(Duration::from_millis(150)).await;
        if let Some(path) = sentinel.lock().unwrap().as_ref() {
            assert!(
                !path.exists(),
                "timed task must eventually clean its sentinel"
            );
        }
        let _ = std::fs::remove_dir(&root);
    }
}
