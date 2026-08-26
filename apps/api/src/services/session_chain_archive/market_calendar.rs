use chrono::{Datelike, NaiveDate, NaiveTime};
use serde::Deserialize;
use std::collections::HashSet;

const ARTIFACT: &str = include_str!("calendars/xnys_full_day_2026_2035.v1.json");

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CalendarError(pub String);
pub type CoverageError = CalendarError;

impl std::fmt::Display for CalendarError { fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str(&self.0) } }
impl std::error::Error for CalendarError {}

#[derive(Debug, Deserialize)]
struct Artifact { calendar_id: String, schema_version: u8, calendar_version: String, domain_start: NaiveDate, domain_end: NaiveDate, scheduled_full_day_closures: Vec<Closure>, exceptional_full_day_closures: Vec<Exceptional> }
#[derive(Debug, Deserialize)]
struct Closure { nominal_date: NaiveDate, closed_et_date: NaiveDate, name: String, observance: String }
#[derive(Debug, Deserialize)]
struct Exceptional { closed_et_date: NaiveDate, reason: String }

#[derive(Clone, Debug)]
pub struct MarketCalendar { pub calendar_id: String, pub schema_version: u8, pub calendar_version: String, pub domain_start: NaiveDate, pub domain_end: NaiveDate, closed: HashSet<NaiveDate> }

impl MarketCalendar {
    pub fn production() -> Result<Self, CalendarError> { Self::from_json(ARTIFACT) }
    pub fn from_json(raw: &str) -> Result<Self, CalendarError> {
        let a: Artifact = serde_json::from_str(raw).map_err(|e| CalendarError(format!("invalid calendar artifact: {e}")))?;
        if a.calendar_id != "XNYS-full-day" || a.schema_version != 1 || a.calendar_version != "2026-2035@2026-08-26.1" || a.domain_start != NaiveDate::from_ymd_opt(2026,1,1).unwrap() || a.domain_end != NaiveDate::from_ymd_opt(2035,12,31).unwrap() { return Err(CalendarError("calendar header is not approved".into())); }
        let names: HashSet<&str> = ["New Year's Day", "Martin Luther King Jr. Day", "Washington's Birthday", "Good Friday", "Memorial Day", "Juneteenth National Independence Day", "Independence Day", "Labor Day", "Thanksgiving Day", "Christmas Day"].into_iter().collect();
        let obs: HashSet<&str> = ["actual", "friday_before", "monday_after"].into_iter().collect();
        let mut closed = HashSet::new(); let mut nominal = HashSet::new();
        for row in a.scheduled_full_day_closures {
            if !names.contains(row.name.as_str()) || !obs.contains(row.observance.as_str()) || row.nominal_date < a.domain_start || row.nominal_date > a.domain_end || row.closed_et_date < a.domain_start || row.closed_et_date > a.domain_end || !nominal.insert(row.nominal_date) || !closed.insert(row.closed_et_date) { return Err(CalendarError("calendar closure row is invalid or duplicated".into())); }
            if row.observance == "actual" && row.nominal_date != row.closed_et_date { return Err(CalendarError("actual closure date mismatch".into())); }
        }
        for row in &a.exceptional_full_day_closures { if row.closed_et_date < a.domain_start || row.closed_et_date > a.domain_end || row.reason.trim().is_empty() || !closed.insert(row.closed_et_date) { return Err(CalendarError("exceptional closure row is invalid or duplicated".into())); } }
        if !a.exceptional_full_day_closures.is_empty() { return Err(CalendarError("exceptional closures are not approved in this version".into())); }
        Ok(Self { calendar_id:a.calendar_id, schema_version:a.schema_version, calendar_version:a.calendar_version, domain_start:a.domain_start, domain_end:a.domain_end, closed })
    }
    pub fn is_eligible(&self, date: NaiveDate) -> Result<bool, CalendarError> { if date < self.domain_start || date > self.domain_end { return Err(CalendarError("date is outside calendar domain".into())); } Ok(date.weekday().number_from_monday() < 6 && !self.closed.contains(&date)) }
    pub fn domain_dates(&self) -> impl Iterator<Item=NaiveDate> { let mut d=self.domain_start; let end=self.domain_end; std::iter::from_fn(move || if d<=end { let out=d; d=d.succ_opt().unwrap(); Some(out) } else { None }) }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CoveragePolicy { pub activation_et_date: NaiveDate, pub checkpoint_et: NaiveTime, pub runtime_lookback_eligible_sessions: usize }
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CoveragePolicyError(pub String);
impl std::fmt::Display for CoveragePolicyError { fn fmt(&self,f:&mut std::fmt::Formatter<'_>)->std::fmt::Result { f.write_str(&self.0) } }
impl std::error::Error for CoveragePolicyError {}
pub const MAX_RUNTIME_LOOKBACK: usize = 20;
impl CoveragePolicy { pub fn production() -> Result<Self,CoveragePolicyError> { Self::new(NaiveDate::from_ymd_opt(2026,8,24).unwrap(),NaiveTime::from_hms_opt(10,30,0).unwrap(),5) } pub fn new(activation_et_date:NaiveDate,checkpoint_et:NaiveTime,runtime_lookback_eligible_sessions:usize)->Result<Self,CoveragePolicyError>{ if runtime_lookback_eligible_sessions==0 || runtime_lookback_eligible_sessions>MAX_RUNTIME_LOOKBACK { return Err(CoveragePolicyError("runtime lookback is outside allowed bounds".into())); } Ok(Self{activation_et_date,checkpoint_et,runtime_lookback_eligible_sessions}) } }

#[cfg(test)]
mod tests { use super::*; #[test] fn production_policy_is_fixed_and_validated(){let p=CoveragePolicy::production().unwrap(); assert_eq!(p.activation_et_date.to_string(),"2026-08-24");assert_eq!(p.checkpoint_et,NaiveTime::from_hms_opt(10,30,0).unwrap());assert_eq!(p.runtime_lookback_eligible_sessions,5);} #[test] fn rejects_zero_or_above_ceiling_lookback(){let d=NaiveDate::from_ymd_opt(2026,1,1).unwrap();assert!(CoveragePolicy::new(d,NaiveTime::MIN,0).is_err());assert!(CoveragePolicy::new(d,NaiveTime::MIN,MAX_RUNTIME_LOOKBACK+1).is_err());} #[test] fn calendar_header_and_closed_vocab_are_exact(){let c=MarketCalendar::production().unwrap();assert_eq!(c.calendar_id,"XNYS-full-day");assert_eq!(c.schema_version,1);assert_eq!(c.calendar_version,"2026-2035@2026-08-26.1");} #[test] fn saturday_sunday_and_every_closure_are_ineligible(){let c=MarketCalendar::production().unwrap();assert!(!c.is_eligible(NaiveDate::from_ymd_opt(2026,8,22).unwrap()).unwrap());assert!(!c.is_eligible(NaiveDate::from_ymd_opt(2026,8,24).unwrap()).unwrap());assert!(!c.is_eligible(NaiveDate::from_ymd_opt(2026,7,3).unwrap()).unwrap());} #[test] fn out_of_domain_is_error(){let c=MarketCalendar::production().unwrap();assert!(c.is_eligible(NaiveDate::from_ymd_opt(2025,12,31).unwrap()).is_err());assert!(c.is_eligible(NaiveDate::from_ymd_opt(2036,1,1).unwrap()).is_err());} }
