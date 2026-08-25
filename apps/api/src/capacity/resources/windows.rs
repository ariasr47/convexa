use super::{ResourceSampler, ResourceSnapshot, SampleError};
pub struct WindowsSampler;
impl ResourceSampler for WindowsSampler {
    fn sample_pid(pid: u32) -> Result<ResourceSnapshot, SampleError> {
        let out = std::process::Command::new("powershell.exe").args(["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", &format!("$p=Get-Process -Id {pid} -ErrorAction Stop; '{pid}`t' + $p.WorkingSet64 + '`t' + $p.Handles")]).output().map_err(|e| SampleError::Unavailable(e.to_string()))?;
        if !out.status.success() {
            return Err(SampleError::Unavailable(
                "sampler exited unsuccessfully".into(),
            ));
        }
        let text = String::from_utf8(out.stdout).map_err(|_| SampleError::Invalid)?;
        let fields: Vec<_> = text.trim().split('\t').map(str::trim).collect();
        if fields.len() != 3 || fields[0] != pid.to_string() {
            return Err(SampleError::Invalid);
        }
        let rss = fields[1].parse().map_err(|_| SampleError::Invalid)?;
        let handles = fields[2].parse().map_err(|_| SampleError::Invalid)?;
        Ok(ResourceSnapshot {
            rss_bytes: rss,
            handles_or_fds: handles,
            semantic: "windows_working_set_bytes_handles",
        })
    }
}
