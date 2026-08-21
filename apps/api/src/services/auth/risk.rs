//! The risk block: derivation and refusals. The effective dollar cap is derived EXACTLY ONCE,
//! HERE. No other module — and no client — multiplies the owner's entered values.
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CapUnit {
    Usd,
    Percent,
}

impl CapUnit {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Usd => "usd",
            Self::Percent => "percent",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "usd" => Some(Self::Usd),
            "percent" => Some(Self::Percent),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct PerTradeCap {
    pub value: f64,
    pub unit: CapUnit,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum CapState {
    Derived,
    NotDerivable,
    NotSet,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct DerivedFrom {
    pub account_size: Option<f64>,
    pub cap_value: Option<f64>,
    pub cap_unit: Option<CapUnit>,
}

#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct EffectiveDollarCap {
    pub state: CapState,
    pub value: Option<f64>,
    pub not_derivable_reason: Option<&'static str>,
    pub derived_from: DerivedFrom,
}

/// Derived **exactly once, server-side**; the client performs no arithmetic on the owner's
/// entered values.
pub fn effective_dollar_cap(
    account_size: Option<f64>,
    cap: Option<PerTradeCap>,
) -> EffectiveDollarCap {
    let derived_from = DerivedFrom {
        account_size,
        cap_value: cap.map(|c| c.value),
        cap_unit: cap.map(|c| c.unit),
    };
    match (cap, account_size) {
        (None, _) => EffectiveDollarCap {
            state: CapState::NotSet,
            value: None,
            not_derivable_reason: None,
            derived_from,
        },
        (Some(c), _) if c.unit == CapUnit::Usd => EffectiveDollarCap {
            state: CapState::Derived,
            value: Some(round2(c.value)),
            not_derivable_reason: None,
            derived_from,
        },
        (Some(c), Some(a)) => EffectiveDollarCap {
            state: CapState::Derived,
            value: Some(round2(a * c.value / 100.0)),
            not_derivable_reason: None,
            derived_from,
        },
        (Some(_), None) => EffectiveDollarCap {
            state: CapState::NotDerivable,
            value: None,
            not_derivable_reason: Some("percent_without_account_size"),
            derived_from,
        },
    }
}

/// Server-side refusals — authoritative, mirroring the client's (INTERFACE §4). Nothing is stored
/// when this returns `Err`. `account_size`/`cap` are double-optional "field present in request"
/// (outer) x "set/clear" (inner) — same shape as `SettingsPatch`.
pub fn validate(
    account_size: Option<Option<f64>>,
    cap: Option<Option<(f64, String)>>,
    stored_account: Option<f64>,
) -> Result<(), &'static str> {
    if let Some(Some(a)) = account_size {
        if !a.is_finite() || a <= 0.0 {
            return Err("Enter a number greater than zero.");
        }
    }
    if let Some(Some((v, ref unit))) = cap {
        if !v.is_finite() || v <= 0.0 {
            return Err("Enter a number greater than zero.");
        }
        match unit.as_str() {
            "percent" => {
                if v > 100.0 {
                    return Err("Enter a percentage between 0 and 100.");
                }
            }
            "usd" => {
                // Compared against the account size AS IT WILL BE after this patch.
                let effective = match account_size {
                    Some(a) => a,
                    None => stored_account,
                };
                if let Some(a) = effective {
                    if v > a {
                        return Err("A dollar cap can't exceed your account size.");
                    }
                }
            }
            _ => return Err("Cap unit must be usd or percent."),
        }
    }
    Ok(())
}

#[inline]
fn round2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

/// `GET`/`PUT /api/auth/settings`'s `risk_inputs` block (INTERFACE_CONTRACT §4).
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
pub struct RiskInputsWire {
    pub state: RiskInputsState,
    pub account_size: Option<f64>,
    pub per_trade_cap: Option<PerTradeCap>,
    pub effective_dollar_cap: EffectiveDollarCap,
    pub storage_available: bool,
    pub updated_at: Option<f64>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RiskInputsState {
    Set,
    NotSet,
}

/// Build the wire block from the four raw record fields — the ONE place a `SettingsRecord`'s
/// risk columns become the response shape (mirrored by `sent.risk_inputs` in the rec response).
pub fn risk_inputs_wire(
    account_size: Option<f64>,
    cap_value: Option<f64>,
    cap_unit: Option<&str>,
    updated_at: Option<f64>,
    storage_available: bool,
) -> RiskInputsWire {
    let per_trade_cap = match (cap_value, cap_unit.and_then(CapUnit::parse)) {
        (Some(value), Some(unit)) => Some(PerTradeCap { value, unit }),
        _ => None,
    };
    let state = if account_size.is_some() || per_trade_cap.is_some() {
        RiskInputsState::Set
    } else {
        RiskInputsState::NotSet
    };
    RiskInputsWire {
        state,
        account_size,
        per_trade_cap,
        effective_dollar_cap: effective_dollar_cap(account_size, per_trade_cap),
        storage_available,
        updated_at,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_dollar_cap_derives_to_itself_with_no_account_size() {
        let r = effective_dollar_cap(
            None,
            Some(PerTradeCap {
                value: 500.0,
                unit: CapUnit::Usd,
            }),
        );
        assert_eq!(r.state, CapState::Derived);
        assert_eq!(r.value, Some(500.0));
    }

    #[test]
    fn a_percent_cap_without_an_account_size_is_not_derivable_and_names_why() {
        let r = effective_dollar_cap(
            None,
            Some(PerTradeCap {
                value: 5.0,
                unit: CapUnit::Percent,
            }),
        );
        assert_eq!(r.state, CapState::NotDerivable);
        assert_eq!(r.not_derivable_reason, Some("percent_without_account_size"));
        assert!(r.value.is_none());
    }

    #[test]
    fn a_percent_cap_derives_against_the_account_size() {
        let r = effective_dollar_cap(
            Some(10_000.0),
            Some(PerTradeCap {
                value: 5.0,
                unit: CapUnit::Percent,
            }),
        );
        assert_eq!(r.state, CapState::Derived);
        assert_eq!(r.value, Some(500.0));
    }

    #[test]
    fn nothing_entered_is_not_set_never_a_zero() {
        let r = effective_dollar_cap(None, None);
        assert_eq!(r.state, CapState::NotSet);
        assert!(r.value.is_none());
    }

    #[test]
    fn a_dollar_cap_above_the_account_size_is_refused() {
        let err =
            validate(Some(Some(1000.0)), Some(Some((2000.0, "usd".into()))), None).unwrap_err();
        assert!(err.contains("account size"));
    }

    #[test]
    fn a_percent_cap_outside_0_to_100_is_refused() {
        let err = validate(None, Some(Some((150.0, "percent".into()))), None).unwrap_err();
        assert!(err.contains("percentage"));
    }

    #[test]
    fn a_percent_cap_is_never_refused_on_account_size_grounds() {
        // Even with NO account size stored or entered, a percent cap must validate — the refusal
        // only applies to a `usd` cap compared against a size.
        assert!(validate(None, Some(Some((50.0, "percent".into()))), None).is_ok());
    }

    #[test]
    fn zero_negative_and_nonfinite_are_refused() {
        assert!(validate(Some(Some(0.0)), None, None).is_err());
        assert!(validate(Some(Some(-5.0)), None, None).is_err());
        assert!(validate(Some(Some(f64::NAN)), None, None).is_err());
    }
}
