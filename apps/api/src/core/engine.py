import numpy as np
import pandas as pd
from datetime import datetime, timezone
import logging
from scipy.stats import norm
from vollib.black_scholes.greeks.numerical import gamma as bs_gamma

logger = logging.getLogger("GammaFlowAsync")


class QuantEngine:
    def __init__(self, risk_free_rate: float = 0.045):
        self.r = risk_free_rate

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

    def _d1_d2(self, S: float, K: float, t: float, r: float, sigma: float):
        """Calculates standard Black-Scholes d1 and d2 components."""
        d1 = (np.log(S / K) + (r + 0.5 * sigma ** 2) * t) / (sigma * np.sqrt(t))
        d2 = d1 - sigma * np.sqrt(t)
        return d1, d2

    def _calc_vanna(self, d1: float, d2: float, sigma: float) -> float:
        """Vanna = dDelta / dVol."""
        return -norm.pdf(d1) * (d2 / sigma)

    def _calc_charm(self, flag: str, t: float, r: float, sigma: float, d1: float, d2: float) -> float:
        """Charm = -dDelta / dTime (Represents underlying asset daily Delta Bleed)."""
        term1 = -norm.pdf(d1) * ((r / (sigma * np.sqrt(t))) - (d2 / (2 * t)))
        if flag in ['call', 'c']:
            return term1 - r * norm.cdf(d1)
        else:
            return term1 + r * norm.cdf(-d1)

    def _calc_volga(self, S: float, t: float, d1: float, d2: float, sigma: float) -> float:
        """Volga (Vomma) = dVega / dVol (Convexity of raw volatility sensitivity)."""
        return S * np.sqrt(t) * norm.pdf(d1) * (d1 * d2 / sigma)

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

    def calculate_vwap_bands(self, latest_vwap: float, closing_prices: list) -> dict:
        """
        Computes 2 and 3 standard deviation volatility bands around the trailing
        VWAP anchor using the last 20 closing sessions.
        """
        if not closing_prices or len(closing_prices) < 20 or latest_vwap <= 0.0:
            return {
                "vwap": latest_vwap,
                "vwap_upper_2": latest_vwap, "vwap_upper_3": latest_vwap,
                "vwap_lower_2": latest_vwap, "vwap_lower_3": latest_vwap
            }
        try:
            # Extract sample standard deviation across a standard 20-day trading window
            sample_series = np.array(closing_prices[-20:], dtype=float)
            historical_std = np.std(sample_series, ddof=1)

            return {
                "vwap": round(latest_vwap, 2),
                "vwap_upper_2": round(latest_vwap + (2.0 * historical_std), 2),
                "vwap_upper_3": round(latest_vwap + (3.0 * historical_std), 2),
                "vwap_lower_2": round(latest_vwap - (2.0 * historical_std), 2),
                "vwap_lower_3": round(latest_vwap - (3.0 * historical_std), 2),
            }
        except Exception:
            return {
                "vwap": latest_vwap,
                "vwap_upper_2": latest_vwap, "vwap_upper_3": latest_vwap,
                "vwap_lower_2": latest_vwap, "vwap_lower_3": latest_vwap
            }

    def process_gex_profile(self, market_data: dict, max_days_to_expiry: float = None) -> dict:
        """
        Transforms the complete chain payload into structural dealer boundaries and
        aggregated hedging risk velocities across all expirations.
        """
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

                sigma = iv / 100.0 if iv > 2.0 else iv
                sigma = max(sigma, 0.0001)
                d1, d2 = self._d1_d2(current_spot, strike, t_years, self.r, sigma)

                vanna = self._calc_vanna(d1, d2, sigma)
                charm = self._calc_charm(contract_type, t_years, self.r, sigma, d1, d2)
                volga = self._calc_volga(current_spot, t_years, d1, d2, sigma)

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
        gamma_flip = self._find_gamma_flip(filtered_contracts, current_spot)
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

    def _find_gamma_flip(self, contracts: list, current_spot: float) -> float:
        """Simulates price shifts (+/- 20%) over the full array to isolate the true zero-gamma line."""
        price_shifts = np.linspace(current_spot * 0.80, current_spot * 1.20, 100)
        previous_gex = None
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
                    sigma = iv / 100.0 if iv > 2.0 else iv

                    calc_gamma = bs_gamma(flag, test_spot, strike, t, self.r, sigma)
                    gex_val = calc_gamma * open_interest * 100 * (test_spot ** 2) * 0.01
                    current_gex += gex_val if flag == 'c' else -gex_val
                except Exception:
                    continue

            if previous_gex is not None and np.sign(current_gex) != np.sign(previous_gex):
                flip_price = test_spot
                break
            previous_gex = current_gex

        return round(float(flip_price), 2)