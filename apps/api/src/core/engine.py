import numpy as np
import pandas as pd
from datetime import datetime, time, timezone
import logging
from scipy.stats import norm

logger = logging.getLogger("GammaFlowAsync")


class QuantEngine:
    def __init__(self, risk_free_rate: float = 0.045, dividend_yield: float = 0.0):
        self.r = risk_free_rate
        # Default continuous dividend yield; can be overridden per-ticker at call time.
        self.q = dividend_yield

    def _calculate_time_to_expiry(self, expiry_str: str) -> float:
        """Calculates time to expiration as a fraction of a 365-day year."""
        try:
            expiry_date = datetime.strptime(expiry_str[:10], "%Y-%m-%d").replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            time_delta = expiry_date - now
            days = max(time_delta.days + (time_delta.seconds / 86400.0), 0.0001)
            return days / 365.0
        except Exception:
            return 0.0001

    def _d1_d2(self, S: float, K: float, t: float, r: float, sigma: float, q: float = 0.0):
        """
        Generalized Black-Scholes d1/d2 using cost-of-carry b = r - q.
        With q = 0 (no dividend) this reduces to the standard BS form.
        """
        b = r - q
        d1 = (np.log(S / K) + (b + 0.5 * sigma ** 2) * t) / (sigma * np.sqrt(t))
        d2 = d1 - sigma * np.sqrt(t)
        return d1, d2

    def _calc_gamma(self, S: float, K: float, t: float, r: float, sigma: float, q: float = 0.0) -> float:
        """Generalized BSM gamma = e^{-q t} * phi(d1) / (S * sigma * sqrt(t))."""
        d1, _ = self._d1_d2(S, K, t, r, sigma, q)
        return np.exp(-q * t) * norm.pdf(d1) / (S * sigma * np.sqrt(t))

    def _calc_vanna(self, d1: float, d2: float, sigma: float, t: float, q: float = 0.0) -> float:
        """Vanna = dDelta / dVol = -e^{-q t} * phi(d1) * d2 / sigma."""
        return -np.exp(-q * t) * norm.pdf(d1) * (d2 / sigma)

    def _calc_charm(self, flag: str, t: float, r: float, sigma: float, d1: float, d2: float, q: float = 0.0) -> float:
        """
        Charm = -dDelta / dTime (daily Delta Bleed), generalized via b = r - q.
        The (b - r) = -q carry term vanishes for non-dividend underlyings, so this
        reduces to the standard zero-carry charm when q = 0.
        """
        b = r - q
        carry = np.exp((b - r) * t)  # == e^{-q t}
        base = norm.pdf(d1) * ((b / (sigma * np.sqrt(t))) - (d2 / (2 * t)))
        if flag in ['call', 'c']:
            return -carry * (base + (b - r) * norm.cdf(d1))
        else:
            return -carry * (base - (b - r) * norm.cdf(-d1))

    def _calc_volga(self, S: float, t: float, d1: float, d2: float, sigma: float, q: float = 0.0) -> float:
        """Volga (Vomma) = dVega / dVol, with the e^{-q t} factor carried through Vega."""
        return S * np.exp(-q * t) * np.sqrt(t) * norm.pdf(d1) * (d1 * d2 / sigma)

    def calculate_historical_volatility_30d(self, closing_prices: list) -> float:
        """
        Calculates the annualized 30-day historical volatility using daily log returns
        and a sample standard deviation (Bessel's correction, degrees of freedom = 1).
        Expects ascending chronological ordering where the latest close is at the end.
        """
        if not closing_prices or len(closing_prices) < 31:
            logger.warning(f"Insufficient close price history provided. Elements: {len(closing_prices) if closing_prices else 0}")
            return 0.0

        try:
            # Slicing out exactly the last 31 chronological trading sessions
            target_series = np.array(closing_prices[-31:], dtype=float)

            # Vectorized Log Returns: ln(P_t / P_t-1)
            log_returns = np.log(target_series[1:] / target_series[:-1])

            # Extract sample standard deviation (ddof=1 applies N-1 institutional variance scaling)
            daily_std = np.std(log_returns, ddof=1)

            # Annualize standard deviation assuming 252 trading sessions per annum
            annualized_hv = daily_std * np.sqrt(252) * 100.0

            if np.isnan(annualized_hv) or np.isinf(annualized_hv):
                return 0.0

            return round(float(annualized_hv), 4)

        except Exception as e:
            logger.error(f"Error computing quantitative 30-day realized volatility: {str(e)}")
            return 0.0

    def calculate_vwap_bands(self, intraday_bars: list, regular_hours_only: bool = True,
                             min_bars: int = 10) -> dict:
        """
        Computes a session-anchored VWAP and volume-weighted standard-deviation bands
        from 1-minute bars. The latest session present in the data is used, so when the
        market is closed this naturally resolves to the last completed session.

            VWAP   = sum(vw_i * v_i) / sum(v_i)
            sigma  = sqrt( sum(v_i * (vw_i - VWAP)^2) / sum(v_i) )
            band_k = VWAP +/- k * sigma

        Returns {} when bars are missing or too sparse (early-session sigma is unstable),
        signalling the caller to emit null VWAP fields rather than misleading numbers.
        """
        if not intraday_bars:
            return {}

        try:
            latest_session = max(b["session"] for b in intraday_bars)
            rows = [
                b for b in intraday_bars
                if b["session"] == latest_session and b.get("v") and b.get("vw") is not None
            ]
            if regular_hours_only:
                rows = [b for b in rows if time(9, 30) <= b["minute"] <= time(16, 0)]

            if len(rows) < min_bars:
                logger.warning(
                    f"VWAP: only {len(rows)} bars for session {latest_session}; insufficient for stable bands.")
                return {}

            vol = np.array([b["v"] for b in rows], dtype=float)
            vw = np.array([b["vw"] for b in rows], dtype=float)
            total_vol = vol.sum()
            if total_vol <= 0:
                return {}

            vwap = float((vw * vol).sum() / total_vol)
            sigma = float(np.sqrt((vol * (vw - vwap) ** 2).sum() / total_vol))

            return {
                "vwap": round(vwap, 2),
                "vwap_upper_2": round(vwap + 2.0 * sigma, 2),
                "vwap_upper_3": round(vwap + 3.0 * sigma, 2),
                "vwap_lower_2": round(vwap - 2.0 * sigma, 2),
                "vwap_lower_3": round(vwap - 3.0 * sigma, 2),
            }
        except Exception as e:
            logger.error(f"Error computing session-anchored VWAP bands: {str(e)}")
            return {}

    def process_gex_profile(self, market_data: dict, max_days_to_expiry: float = None,
                            dividend_yield: float = None) -> dict:
        """
        Transforms the complete chain payload into structural dealer boundaries and
        aggregated hedging risk velocities across all expirations.

        dividend_yield overrides the engine default for this ticker; pass the
        underlying's continuous dividend yield (0.0 for non-payers like TSLA).
        """
        q = self.q if dividend_yield is None else dividend_yield
        contracts = market_data.get("contracts", [])
        current_spot = market_data.get("synchronized_spot", 0.0)

        if not contracts or current_spot <= 0:
            return {
                "net_gex": 0.0, "call_wall": 0.0, "put_wall": 0.0, "gamma_flip": 0.0,
                "net_vanna": 0.0, "net_charm": 0.0, "net_volga": 0.0, "put_call_ratio": 0.0
            }

        total_net_gex, total_net_vanna, total_net_charm, total_net_volga = 0.0, 0.0, 0.0, 0.0
        strike_gex_map = {}
        filtered_contracts = []

        total_call_oi = 0
        total_put_oi = 0

        for contract in contracts:
            try:
                expiry = contract.get("expiration_date", "")
                t_years = self._calculate_time_to_expiry(str(expiry))
                days_to_expiry = t_years * 365.0

                if max_days_to_expiry is not None and days_to_expiry > max_days_to_expiry:
                    continue

                strike = contract["strike_price"]
                contract_type = contract["contract_type"].lower()
                open_interest = contract["open_interest"]
                api_gamma = contract["greeks"]["gamma"]
                iv = contract["implied_volatility"]

                filtered_contracts.append(contract)

                if contract_type in ['call', 'c']:
                    total_call_oi += open_interest
                elif contract_type in ['put', 'p']:
                    total_put_oi += open_interest

                # Primary Dollar GEX Scale Formula: Gamma * OI * 100 * Spot^2 * 0.01 [cite: 14]
                dollar_gex = api_gamma * open_interest * 100 * (current_spot ** 2) * 0.01

                # IV arrives as a decimal from the data layer (e.g. 0.486).
                sigma = max(iv, 0.0001)
                d1, d2 = self._d1_d2(current_spot, strike, t_years, self.r, sigma, q)

                vanna = self._calc_vanna(d1, d2, sigma, t_years, q)
                charm = self._calc_charm(contract_type, t_years, self.r, sigma, d1, d2, q)
                volga = self._calc_volga(current_spot, t_years, d1, d2, sigma, q)

                # Dollar Exposure Normalizations
                dollar_vanna = vanna * 0.01 * open_interest * 100 * current_spot
                dollar_charm = charm * (1.0 / 365.0) * open_interest * 100 * current_spot
                dollar_volga = volga * 0.01 * 0.01 * open_interest * 100

                if contract_type in ['put', 'p']:
                    dollar_gex *= -1.0
                    dollar_vanna *= -1.0
                    dollar_charm *= -1.0
                    dollar_volga *= -1.0

                total_net_gex += dollar_gex
                total_net_vanna += dollar_vanna
                total_net_charm += dollar_charm
                total_net_volga += dollar_volga

                if strike not in strike_gex_map:
                    strike_gex_map[strike] = {"call_gex": 0.0, "put_gex": 0.0, "net_gex": 0.0}

                if contract_type in ['call', 'c']:
                    strike_gex_map[strike]["call_gex"] += dollar_gex
                else:
                    strike_gex_map[strike]["put_gex"] += dollar_gex

                strike_gex_map[strike]["net_gex"] += dollar_gex

            except Exception:
                continue

        if not strike_gex_map:
            return {
                "net_gex": 0.0, "call_wall": 0.0, "put_wall": 0.0, "gamma_flip": 0.0,
                "net_vanna": 0.0, "net_charm": 0.0, "net_volga": 0.0, "put_call_ratio": 0.0
            }

        df_strikes = pd.DataFrame.from_dict(strike_gex_map, orient='index')
        call_wall = float(df_strikes['call_gex'].idxmax())
        put_wall = float(df_strikes['put_gex'].idxmin())
        gamma_flip = self._find_gamma_flip(filtered_contracts, current_spot, q)
        pc_ratio = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 0.0

        return {
            "net_gex": round(total_net_gex, 2),
            "call_wall": call_wall,
            "put_wall": put_wall,
            "gamma_flip": gamma_flip,
            "net_vanna": round(total_net_vanna, 2),
            "net_charm": round(total_net_charm, 2),
            "net_volga": round(total_net_volga, 2),
            "put_call_ratio": pc_ratio
        }

    def _find_gamma_flip(self, contracts: list, current_spot: float, q: float = 0.0) -> float:
        """Simulates price shifts (+/- 20%) over the full array to isolate the true zero-gamma line."""
        price_shifts = np.linspace(current_spot * 0.80, current_spot * 1.20, 100)
        previous_gex = None
        previous_spot = None
        flip_price = current_spot

        for test_spot in price_shifts:
            current_gex = 0.0
            for contract in contracts:
                try:
                    strike = contract["strike_price"]
                    expiry = contract["expiration_date"]
                    contract_type = contract["contract_type"]
                    open_interest = contract["open_interest"]
                    iv = contract["implied_volatility"]
                    if iv <= 0.0: continue

                    t = self._calculate_time_to_expiry(str(expiry))
                    flag = 'c' if contract_type in ['call', 'c'] else 'p'
                    sigma = iv  # decimal IV from the data layer

                    calc_gamma = self._calc_gamma(test_spot, strike, t, self.r, sigma, q)
                    gex_val = calc_gamma * open_interest * 100 * (test_spot ** 2) * 0.01
                    current_gex += gex_val if flag == 'c' else -gex_val
                except Exception:
                    continue

            if previous_gex is not None and np.sign(current_gex) != np.sign(previous_gex):
                # Linearly interpolate the zero crossing between the two bracketing
                # grid points rather than snapping to the coarse grid step.
                gex_span = current_gex - previous_gex
                if gex_span != 0.0:
                    flip_price = previous_spot + (-previous_gex) * (test_spot - previous_spot) / gex_span
                else:
                    flip_price = test_spot
                break

            previous_gex = current_gex
            previous_spot = test_spot

        return round(float(flip_price), 2)