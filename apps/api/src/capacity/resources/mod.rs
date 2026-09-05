//! Cross-platform process resource evidence. Missing or unsupported samples are errors.

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ResourceSnapshot {
    pub rss_bytes: u64,
    pub handles_or_fds: u64,
    pub semantic: &'static str,
}

#[derive(Debug, thiserror::Error)]
pub enum SampleError {
    #[error("unsupported platform")]
    Unsupported,
    #[error("process sample unavailable: {0}")]
    Unavailable(String),
    #[error("invalid process sample")]
    Invalid,
}

pub trait ResourceSampler {
    fn sample_pid(pid: u32) -> Result<ResourceSnapshot, SampleError>;
}

#[cfg(target_os = "linux")]
pub mod linux;
#[cfg(target_os = "windows")]
pub mod windows;

// `pid` is consumed by the windows and linux arms below; on any other target both are
// compiled out and it is genuinely unused. CI is linux, so this never fires there.
#[cfg_attr(
    not(any(target_os = "windows", target_os = "linux")),
    allow(unused_variables)
)]
pub fn sample_pid(pid: u32) -> Result<ResourceSnapshot, SampleError> {
    #[cfg(target_os = "windows")]
    {
        return windows::WindowsSampler::sample_pid(pid);
    }
    #[cfg(target_os = "linux")]
    {
        return linux::LinuxSampler::sample_pid(pid);
    }
    #[allow(unreachable_code)]
    Err(SampleError::Unsupported)
}
