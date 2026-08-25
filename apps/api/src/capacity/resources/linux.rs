use super::{ResourceSampler, ResourceSnapshot, SampleError};
pub struct LinuxSampler;
impl ResourceSampler for LinuxSampler {
    fn sample_pid(pid: u32) -> Result<ResourceSnapshot, SampleError> {
        let status = std::fs::read_to_string(format!("/proc/{pid}/status"))
            .map_err(|e| SampleError::Unavailable(e.to_string()))?;
        let kb = status
            .lines()
            .find_map(|line| {
                line.strip_prefix("VmRSS:")
                    .and_then(|v| v.split_whitespace().next())
            })
            .ok_or(SampleError::Invalid)?
            .parse::<u64>()
            .map_err(|_| SampleError::Invalid)?;
        let rss_bytes = kb.checked_mul(1024).ok_or(SampleError::Invalid)?;
        let handles_or_fds = std::fs::read_dir(format!("/proc/{pid}/fd"))
            .map_err(|e| SampleError::Unavailable(e.to_string()))?
            .filter_map(Result::ok)
            .count() as u64;
        Ok(ResourceSnapshot {
            rss_bytes,
            handles_or_fds,
            semantic: "linux_vmrss_bytes_fd_entries",
        })
    }
}
