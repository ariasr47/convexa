import numpy as np
from datetime import datetime, time, timezone
import logging
from scipy.stats import norm

logger = logging.getLogger("Convexa")


class QuantEngine:
    # Floor on time-to-expiry (years) for the analytical greeks. Charm ~ 1/t and
    # gamma ~ 1/sqrt(t) diverge as t -> 0, so 0DTE/expiring contracts are clamped to
    # ~1 trading day to keep the aggregates finite and meaningful.
    MIN_GREEK_T = 1.0 / 365.0

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
            logger.warning(f"30-day HV: insufficient price history ({len(closing_prices) if closing_prices else 0} closes, need 31); returning 0")
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
            logger.error(f"30-day HV: computation failed: {e}")
            return 0.0

    def calculate_vwap_bands(self, intraday_bars: list, regular_hours_only: bool = True,
                             min_bars: int = 10) -> dict:
        """
        Computes a session-anchored VWAP and volume-weighted standard-deviation bands
        from 1-minute bars, using the latest session that actually has enough RTH bars.
        Pre-market on a new day (or weekend/holiday) the current calendar session has no
        regular-hours bars yet, so this falls back to the last completed RTH session --
        the same "last completed session" basis used for the GEX spot.

            VWAP   = sum(vw_i * v_i) / sum(v_i)
            sigma  = sqrt( sum(v_i * (vw_i - VWAP)^2) / sum(v_i) )
            band_k = VWAP +/- k * sigma

        Returns {} when no session has enough bars (early-session sigma is unstable),
        signalling the caller to emit null VWAP fields rather than misleading numbers.
        """
        if not intraday_bars:
            return {}

        try:
            # Group RTH-eligible bars by session, then pick the latest session that has
            # at least min_bars (so pre-market/new-day falls back to the prior session).
            sessions: dict = {}
            for b in intraday_bars:
                if not b.get("v") or b.get("vw") is None:
                    continue
                if regular_hours_only and not (time(9, 30) <= b["minute"] <= time(16, 0)):
                    continue
                sessions.setdefault(b["session"], []).append(b)

            usable = sorted((s for s, r in sessions.items() if len(r) >= min_bars), reverse=True)
            if not usable:
                logger.warning(f"VWAP: no session with >= {min_bars} RTH bars; skipping bands")
                return {}

            session = usable[0]
            rows = sessions[session]

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
            logger.error(f"VWAP: failed to compute session-anchored bands: {e}")
            return {}

    @staticmethod
    def _empty_gex_result() -> dict:
        """Zeroed GEX result used when no usable contracts/spot are available."""
        return {
            "net_gex": 0.0, "call_gex": 0.0, "put_gex": 0.0, "total_gex": 0.0,
            "call_wall": 0.0, "put_wall": 0.0, "peak_gex_strike": 0.0,
            "gamma_flip": 0.0, "max_pain": 0.0, "max_pain_expiration": None,
            "net_vanna": 0.0, "net_charm": 0.0, "net_volga": 0.0, "put_call_ratio": 0.0,
            # New always-on metrics: all unavailable when there is no usable chain.
            "net_dex": None, "call_dex": None, "put_dex": None,
            "total_volume": None, "chain_vol_oi_ratio": None,
            "strike_profile": [],
        }

    @staticmethod
    def _is_monthly_expiration(expiry_str: str) -> bool:
        """True if the date is a standard monthly OPEX (the 3rd Friday of the month)."""
        try:
            d = datetime.strptime(expiry_str[:10], "%Y-%m-%d")
            return d.weekday() == 4 and 15 <= d.day <= 21
        except Exception:
            return False

    @staticmethod
    def _calculate_max_pain(strike_oi_map: dict) -> float:
        """
        Max pain = the price that minimizes total intrinsic payout to option holders,
        given a single expiration's per-strike OI ({strike: {call_oi, put_oi}}). Max
        pain is a per-expiration concept, so the caller passes one expiration's map;
        aggregating all expirations would let deep LEAP OI distort the result.
        """
        strikes = sorted(strike_oi_map.keys())
        if not strikes:
            return 0.0

        best_strike, best_payout = strikes[0], None
        for k_test in strikes:
            payout = 0.0
            for k, oi in strike_oi_map.items():
                if k_test > k:        # calls expire ITM
                    payout += (k_test - k) * oi["call_oi"] * 100
                elif k_test < k:      # puts expire ITM
                    payout += (k - k_test) * oi["put_oi"] * 100
            if best_payout is None or payout < best_payout:
                best_payout, best_strike = payout, k_test
        return float(best_strike)

    def process_gex_profile(self, market_data: dict, max_days_to_expiry: float = None,
                            min_days_to_expiry: float = None,
                            expirations: set = None,
                            dividend_yield: float = None) -> dict:
        """
        Transforms the complete chain payload into structural dealer boundaries and
        aggregated hedging risk velocities across the chosen expiration window.

        min_days_to_expiry / max_days_to_expiry bound the DTE window the gamma
        structure is computed over (None = unbounded). Restricting to longer-dated
        contracts (e.g. min 7, max 45) yields stabler walls/GEX/gamma-flip for swing
        horizons, free of the 0DTE/weekly noise that shifts intraday. The window shapes
        every gamma metric (walls, peak GEX, net/call/put GEX, gamma flip) but NOT max
        pain, which keeps its own nearest-monthly-OPEX basis.

        expirations, when provided, restricts the gamma structure to that explicit set of
        expiration dates (YYYY-MM-DD); contracts outside it are dropped. It is applied
        alongside the DTE window (both must pass) and, like the DTE window, shapes only
        the gamma structure, not max pain / put-call ratio.

        dividend_yield overrides the engine default for this ticker; pass the
        underlying's continuous dividend yield (0.0 for non-payers like TSLA).
        """
        q = self.q if dividend_yield is None else dividend_yield
        contracts = market_data.get("contracts", [])
        current_spot = market_data.get("synchronized_spot", 0.0)

        if not contracts or current_spot <= 0:
            return self._empty_gex_result()

        total_net_gex, total_net_vanna, total_net_charm, total_net_volga = 0.0, 0.0, 0.0, 0.0
        total_call_gex, total_put_gex = 0.0, 0.0
        strike_gex_map = {}
        exp_oi_map = {}   # expiration -> {strike: {call_oi, put_oi}}, for per-expiration max pain
        exp_dte = {}      # expiration -> days to expiry
        filtered_contracts = []

        total_call_oi = 0
        total_put_oi = 0

        # --- DEX (window-scoped, like GEX): dealer dollar delta exposure. Vendor delta carries
        # its own sign (calls +, puts -), so the signed sum nets directly -- no extra put
        # negation (that is how GEX gets its calls-+/puts-- convention; delta provides it here).
        total_net_dex, total_call_dex, total_put_dex = 0.0, 0.0, 0.0
        dex_contributors = 0          # contracts with a usable vendor delta; 0 => DEX null chain-wide
        # --- Vol/OI (FULL CHAIN, independent of the DTE filter): session volume by strike.
        strike_volume_map = {}        # strike -> summed session volume (full chain)
        total_volume = 0.0
        volume_available = False       # any contract reported volume; else Vol/OI null chain-wide

        # Exchange "today" (UTC date is close enough; the t-floor below covers the
        # midnight edge). Contracts expiring before today are dropped entirely.
        today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

        for contract in contracts:
            try:
                expiry = contract.get("expiration_date", "")

                # Drop already-expired contracts: they carry no forward risk and their
                # analytical greeks (charm ~ 1/t) diverge near expiry.
                if not expiry or expiry[:10] < today_str:
                    continue

                t_years = self._calculate_time_to_expiry(str(expiry))
                days_to_expiry = t_years * 365.0

                strike = contract["strike_price"]
                contract_type = contract["contract_type"].lower()
                open_interest = contract["open_interest"]

                # Open-interest metrics (put/call ratio, max pain) count EVERY contract,
                # including ones Massive could not price greeks for -- open interest
                # exists independently of greek availability, and dropping unpriced
                # (typically deep-ITM) contracts would bias these aggregates. OI is kept
                # per-expiration so max pain can be computed on a single expiration.
                if expiry not in exp_oi_map:
                    exp_oi_map[expiry] = {}
                    exp_dte[expiry] = days_to_expiry
                strikes_oi = exp_oi_map[expiry]
                if strike not in strikes_oi:
                    strikes_oi[strike] = {"call_oi": 0, "put_oi": 0}

                if contract_type in ['call', 'c']:
                    total_call_oi += open_interest
                    strikes_oi[strike]["call_oi"] += open_interest
                elif contract_type in ['put', 'p']:
                    total_put_oi += open_interest
                    strikes_oi[strike]["put_oi"] += open_interest

                # Vol/OI is FULL-CHAIN (same basis as max pain / PCR): accumulate session
                # volume here, BEFORE the DTE filter, so the window selection can't shape it.
                contract_volume = contract.get("volume")
                if contract_volume is not None:
                    volume_available = True
                    v = float(contract_volume)
                    total_volume += v
                    strike_volume_map[strike] = strike_volume_map.get(strike, 0.0) + v

                # DTE window applies to the gamma structure only (walls, peak GEX,
                # net/call/put GEX, and the gamma flip via filtered_contracts). It is
                # placed AFTER the OI accounting so max pain and the put/call ratio stay
                # on the full chain, independent of the window the caller selects.
                if max_days_to_expiry is not None and days_to_expiry > max_days_to_expiry:
                    continue
                if min_days_to_expiry is not None and days_to_expiry < min_days_to_expiry:
                    continue
                if expirations is not None and expiry[:10] not in expirations:
                    continue

                # GEX and the higher-order greeks require a priced gamma; skip unpriced
                # contracts here only (their OI was already counted above).
                api_gamma = (contract.get("greeks") or {}).get("gamma")
                if api_gamma is None:
                    continue
                iv = contract["implied_volatility"]

                filtered_contracts.append(contract)

                # DEX (window-scoped): dollar dealer delta = delta * OI * 100 * spot, using
                # VENDOR delta (no analytic repricing). Vendor delta is signed (call +, put -),
                # so it nets directly. A contract with no vendor delta contributes 0 and is
                # skipped for DEX only -- GEX above is unaffected.
                api_delta = (contract.get("greeks") or {}).get("delta")
                if api_delta is not None:
                    dollar_dex = api_delta * open_interest * 100 * current_spot
                    dex_contributors += 1
                    total_net_dex += dollar_dex
                    sg = strike_gex_map.setdefault(
                        strike, {"call_gex": 0.0, "put_gex": 0.0, "net_gex": 0.0,
                                 "call_dex": 0.0, "put_dex": 0.0, "net_dex": 0.0})
                    sg["net_dex"] += dollar_dex
                    if contract_type in ['call', 'c']:
                        total_call_dex += dollar_dex
                        sg["call_dex"] += dollar_dex
                    else:
                        total_put_dex += dollar_dex
                        sg["put_dex"] += dollar_dex

                # Primary Dollar GEX Scale Formula: Gamma * OI * 100 * Spot^2 * 0.01 [cite: 14]
                dollar_gex = api_gamma * open_interest * 100 * (current_spot ** 2) * 0.01

                # IV arrives as a decimal from the data layer (e.g. 0.486).
                sigma = max(iv, 0.0001)
                # Clamp time so near-expiry greeks (esp. charm ~ 1/t) stay finite.
                t_greek = max(t_years, self.MIN_GREEK_T)
                d1, d2 = self._d1_d2(current_spot, strike, t_greek, self.r, sigma, q)

                vanna = self._calc_vanna(d1, d2, sigma, t_greek, q)
                charm = self._calc_charm(contract_type, t_greek, self.r, sigma, d1, d2, q)
                volga = self._calc_volga(current_spot, t_greek, d1, d2, sigma, q)

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
                    strike_gex_map[strike] = {"call_gex": 0.0, "put_gex": 0.0, "net_gex": 0.0,
                                              "call_dex": 0.0, "put_dex": 0.0, "net_dex": 0.0}

                if contract_type in ['call', 'c']:
                    strike_gex_map[strike]["call_gex"] += dollar_gex
                    total_call_gex += dollar_gex
                else:
                    strike_gex_map[strike]["put_gex"] += dollar_gex
                    total_put_gex += dollar_gex

                strike_gex_map[strike]["net_gex"] += dollar_gex

            except Exception:
                continue

        if not strike_gex_map:
            return self._empty_gex_result()

        # Walls are the extremes of the per-strike NET gamma profile (call gamma plus the
        # negative put gamma at each strike), aggregated across all expirations -- matching
        # the InsiderFinance Strike Profile chart: the most positive net-GEX strike is the
        # call wall (resistance), the most negative is the put wall (support). Using NET
        # (not call-only / put-only) is what separates the walls: at the round ATM strike
        # heavy calls and puts offset, so the extremes land on the OTM call/put
        # concentrations. LEAP strikes can't pollute this since their gamma is negligible.
        call_wall = float(max(strike_gex_map, key=lambda k: strike_gex_map[k]["net_gex"]))
        put_wall = float(min(strike_gex_map, key=lambda k: strike_gex_map[k]["net_gex"]))

        # Peak GEX strike = the strike with the most total (gross) gamma exposure; the
        # price magnet. This is the gamma-based concentration metric (distinct from walls).
        peak_gex_strike = float(max(
            strike_gex_map,
            key=lambda k: abs(strike_gex_map[k]["call_gex"]) + abs(strike_gex_map[k]["put_gex"])
        ))

        gamma_flip = self._find_gamma_flip(filtered_contracts, current_spot, q)
        pc_ratio = round(total_put_oi / total_call_oi, 2) if total_call_oi > 0 else 0.0

        # Max pain on the nearest MONTHLY expiration (3rd-Friday OPEX). Monthly OPEX
        # carries the deepest, most stable OI and is the conventional max-pain reference;
        # near-dated weeklies/0DTE give noisy levels. Falls back to the nearest expiration
        # only if the chain has no monthly. (Avoids LEAP OI distorting an all-chain sum.)
        future_exps = {e: d for e, d in exp_dte.items() if d > 0 and e}
        monthly_exps = {e: d for e, d in future_exps.items() if self._is_monthly_expiration(e)}
        target_exps = monthly_exps or future_exps
        if target_exps:
            max_pain_expiration = min(target_exps, key=target_exps.get)
            max_pain = self._calculate_max_pain(exp_oi_map[max_pain_expiration])
        else:
            max_pain_expiration, max_pain = None, 0.0

        # Gross split: total_gex sums magnitudes (put_gex is stored negative), matching
        # the "Call GEX / Put GEX / Total GEX" breakdown shown on retail dashboards.
        total_gex = abs(total_call_gex) + abs(total_put_gex)

        # DEX null semantics: if not a single contract carried a vendor delta, DEX is
        # unavailable chain-wide -> null aggregates AND null per-strike rows (FE shows DEX
        # "unavailable" while GEX is untouched). Otherwise emit the signed dollar exposures.
        dex_available = dex_contributors > 0
        # Vol/OI null semantics: if the vendor reported no per-contract volume anywhere, the
        # whole Vol/OI metric is null (FE renders blank, not zero). Full-chain OI basis.
        total_chain_oi = total_call_oi + total_put_oi
        chain_vol_oi_ratio = (round(total_volume / total_chain_oi, 4)
                              if volume_available and total_chain_oi > 0 else None)

        # Per-strike profile (net/call/put GEX + call/put OI, + DEX & Vol/OI), all
        # expirations, for the UI Strike Profile chart and wall diagnostics. OI is summed
        # across expirations (priced + unpriced); GEX/DEX come from priced contracts in
        # strike_gex_map (window-scoped); volume is full-chain.
        strike_oi_total = {}
        for strikes in exp_oi_map.values():
            for k, oi in strikes.items():
                acc = strike_oi_total.setdefault(k, {"call_oi": 0, "put_oi": 0})
                acc["call_oi"] += oi["call_oi"]
                acc["put_oi"] += oi["put_oi"]

        _empty_g = {"call_gex": 0.0, "put_gex": 0.0, "net_gex": 0.0,
                    "call_dex": 0.0, "put_dex": 0.0, "net_dex": 0.0}
        strike_profile = []
        for k in sorted(set(strike_gex_map) | set(strike_oi_total)):
            g = strike_gex_map.get(k, _empty_g)
            o = strike_oi_total.get(k, {"call_oi": 0, "put_oi": 0})
            total_oi = o["call_oi"] + o["put_oi"]

            # Per-strike Vol/OI: null when volume unavailable chain-wide, this strike has no
            # volume, or total_oi <= 0 (FE renders blank, never a misleading 0).
            strike_vol = strike_volume_map.get(k) if volume_available else None
            vol_oi_ratio = (round(strike_vol / total_oi, 4)
                            if (strike_vol and strike_vol > 0 and total_oi > 0) else None)

            strike_profile.append({
                "strike": k,
                "net_gex": round(g["net_gex"], 2),
                "call_gex": round(g["call_gex"], 2),
                "put_gex": round(g["put_gex"], 2),
                "call_oi": o["call_oi"],
                "put_oi": o["put_oi"],
                "total_oi": total_oi,
                "net_dex": round(g["net_dex"], 2) if dex_available else None,
                "call_dex": round(g["call_dex"], 2) if dex_available else None,
                "put_dex": round(g["put_dex"], 2) if dex_available else None,
                "volume": int(strike_vol) if (volume_available and strike_vol is not None) else None,
                "vol_oi_ratio": vol_oi_ratio,
            })

        return {
            "net_gex": round(total_net_gex, 2),
            "call_gex": round(total_call_gex, 2),
            "put_gex": round(total_put_gex, 2),
            "total_gex": round(total_gex, 2),
            "call_wall": call_wall,
            "put_wall": put_wall,
            "peak_gex_strike": peak_gex_strike,
            "gamma_flip": gamma_flip,
            "max_pain": max_pain,
            "max_pain_expiration": max_pain_expiration,
            "net_vanna": round(total_net_vanna, 2),
            "net_charm": round(total_net_charm, 2),
            "net_volga": round(total_net_volga, 2),
            "put_call_ratio": pc_ratio,
            "net_dex": round(total_net_dex, 2) if dex_available else None,
            "call_dex": round(total_call_dex, 2) if dex_available else None,
            "put_dex": round(total_put_dex, 2) if dex_available else None,
            "total_volume": round(total_volume, 2) if volume_available else None,
            "chain_vol_oi_ratio": chain_vol_oi_ratio,
            "strike_profile": strike_profile,
        }

    def _gex_curve(self, contracts: list, price_shifts: np.ndarray, q: float = 0.0) -> np.ndarray:
        """
        Net dealer GEX at every spot in `price_shifts`, repricing gamma analytically across
        the whole chain. Vectorized over the (grid x contracts) matrix: for each priced
        contract the per-spot contribution is exactly

            e^{-q t} * phi(d1) / (S * sigma * sqrt(t)) * OI * 100 * S^2 * 0.01

        signed + for calls and - for puts -- i.e. _calc_gamma() per contract, summed. This
        is the same formula the scalar double-loop used, just evaluated as NumPy arrays
        instead of one scipy.norm.pdf call per (spot, contract) pair.
        """
        K, t, sigma, oi, sign = [], [], [], [], []
        for c in contracts:
            iv = c["implied_volatility"]
            if iv <= 0.0:
                continue
            K.append(c["strike_price"])
            t.append(max(self._calculate_time_to_expiry(str(c["expiration_date"])), self.MIN_GREEK_T))
            sigma.append(iv)  # decimal IV from the data layer
            oi.append(c["open_interest"])
            sign.append(1.0 if c["contract_type"] in ['call', 'c'] else -1.0)

        if not K:
            return np.zeros_like(price_shifts, dtype=float)

        K = np.asarray(K, dtype=float)
        t = np.asarray(t, dtype=float)
        sigma = np.asarray(sigma, dtype=float)
        oi = np.asarray(oi, dtype=float)
        sign = np.asarray(sign, dtype=float)

        S = np.asarray(price_shifts, dtype=float)[:, None]               # (G, 1)
        b = self.r - q
        sqrt_t = np.sqrt(t)                                              # (N,)
        d1 = (np.log(S / K) + (b + 0.5 * sigma ** 2) * t) / (sigma * sqrt_t)  # (G, N)
        gamma = np.exp(-q * t) * norm.pdf(d1) / (S * sigma * sqrt_t)     # (G, N)
        gex = gamma * oi * 100.0 * (S ** 2) * 0.01 * sign               # (G, N)
        return gex.sum(axis=1)                                          # (G,)

    def _find_gamma_flip(self, contracts: list, current_spot: float, q: float = 0.0) -> float:
        """
        Finds the zero-gamma level by repricing net GEX across +/-20% spot shifts and
        locating where it crosses zero. The net-gamma profile is often choppy near spot
        (many sign changes across discrete high-OI strikes), so we return the crossing
        NEAREST to the current spot -- the actionable regime boundary -- rather than the
        lowest crossing in the scan.
        """
        price_shifts = np.linspace(current_spot * 0.80, current_spot * 1.20, 100)
        gex_curve = self._gex_curve(contracts, price_shifts, q)

        # Collect EVERY zero crossing (interpolated) so we can see whether the flip is a
        # single regime boundary or one of several. Diagnostic for the flip methodology.
        crossings = []

        for i in range(1, len(price_shifts)):
            previous_spot = price_shifts[i - 1]
            test_spot = price_shifts[i]
            previous_gex = gex_curve[i - 1]
            current_gex = gex_curve[i]

            if np.sign(current_gex) != np.sign(previous_gex):
                # Linearly interpolate the zero crossing between the two bracketing
                # grid points rather than snapping to the coarse grid step.
                gex_span = current_gex - previous_gex
                if gex_span != 0.0:
                    cross = previous_spot + (-previous_gex) * (test_spot - previous_spot) / gex_span
                else:
                    cross = test_spot
                # direction: '-> +' means net gamma turns positive moving up through here
                direction = "-> +" if current_gex > previous_gex else "-> -"
                crossings.append((round(float(cross), 2), direction))

        if not crossings:
            logger.info("Gamma flip: no zero crossing found in +/-20% scan; defaulting to spot")
            return round(float(current_spot), 2)

        # The regime boundary that matters is the crossing nearest the current spot.
        nearest_cross = min(crossings, key=lambda c: abs(c[0] - current_spot))[0]
        logger.info(
            f"Gamma flip ${nearest_cross} (nearest to spot ${current_spot:.2f} "
            f"of {len(crossings)} zero crossing(s))"
        )
        logger.debug(f"Gamma flip crossings: {crossings}")
        return nearest_cross

    # 25-delta reference targets and the fixed-moneyness fallback offset (≈ ±5% OTM).
    _SKEW_DELTA = 0.25
    _SKEW_MONEYNESS = 0.05
    # Term-structure flat band: |far − near| within this fraction of near IV reads as "flat".
    _TERM_FLAT_REL = 0.01

    def compute_iv_skew(self, contracts: list, spot: float, anchor_expiration: str,
                        anchor_dte: int | None) -> dict | None:
        """
        Put-vs-call IV skew at a single anchor tenor (the nearest expiration >= 7 DTE the
        provider already picked for ATM IV). Reference IVs come from the ±25-delta call/put
        (vendor delta to bucket); when delta is unusable at the tenor it falls back to a fixed
        ≈±5%-OTM moneyness pick. `slope = put_iv − call_iv` in IV points (downside richer => +).

        Guarded + best-effort: returns None on too few / zero-IV contracts at the tenor (the FE
        renders skew "unavailable"); never raises into the bundle. Full-chain input — the anchor
        tenor is independent of the DTE window.
        """
        try:
            if not anchor_expiration or spot <= 0:
                return None
            tenor = [c for c in contracts
                     if (c.get("expiration_date") or "")[:10] == anchor_expiration[:10]
                     and c.get("implied_volatility", 0.0) > 0.0]
            calls = [c for c in tenor if c["contract_type"] in ("call", "c")]
            puts = [c for c in tenor if c["contract_type"] in ("put", "p")]
            if not calls or not puts:
                return None

            def _delta(c):
                return (c.get("greeks") or {}).get("delta")

            calls_d = [c for c in calls if _delta(c) is not None]
            puts_d = [c for c in puts if _delta(c) is not None]

            if calls_d and puts_d:
                call_ref = min(calls_d, key=lambda c: abs(_delta(c) - self._SKEW_DELTA))
                put_ref = min(puts_d, key=lambda c: abs(_delta(c) - (-self._SKEW_DELTA)))
                reference = "25d"
            else:
                # Fixed-moneyness fallback: ≈5% OTM call (above spot) and put (below spot).
                call_ref = min(calls, key=lambda c: abs(c["strike_price"] - spot * (1 + self._SKEW_MONEYNESS)))
                put_ref = min(puts, key=lambda c: abs(c["strike_price"] - spot * (1 - self._SKEW_MONEYNESS)))
                reference = "moneyness"

            call_iv = call_ref["implied_volatility"] * 100.0
            put_iv = put_ref["implied_volatility"] * 100.0
            return {
                "slope": round(put_iv - call_iv, 4),
                "put_iv": round(put_iv, 4),
                "call_iv": round(call_iv, 4),
                "dte": int(anchor_dte) if anchor_dte is not None else None,
                "expiration": anchor_expiration[:10],
                "reference": reference,
            }
        except Exception as e:
            logger.error(f"IV skew: computation failed: {e}")
            return None

    def compute_term_structure(self, contracts: list, spot: float) -> dict | None:
        """
        ATM-IV-by-tenor curve across ALL available expirations (cross-tenor; ignores the DTE
        window). Per expiration: ATM IV = avg of call+put IV at the strike nearest spot (IV>0
        only), mirroring the provider's ATM-IV selection. Emits the FULL curve ascending by DTE
        (the FE samples display buckets); sparse/absent tenors are simply omitted, never faked.

        `state` is server-emitted: contango (far > near), backwardation (far < near), or flat
        (within _TERM_FLAT_REL of near IV). Guarded + best-effort: None when no usable tenor.
        """
        try:
            if spot <= 0:
                return None
            by_exp: dict = {}
            for c in contracts:
                exp = (c.get("expiration_date") or "")[:10]
                if not exp or c.get("implied_volatility", 0.0) <= 0.0:
                    continue
                by_exp.setdefault(exp, []).append(c)

            points = []
            for exp, rows in by_exp.items():
                dte = round(self._calculate_time_to_expiry(exp) * 365.0)
                if dte <= 0:
                    continue
                atm_strike = min(rows, key=lambda c: abs(c["strike_price"] - spot))["strike_price"]
                ivs = [c["implied_volatility"] for c in rows if c["strike_price"] == atm_strike]
                if not ivs:
                    continue
                atm_iv = (sum(ivs) / len(ivs)) * 100.0
                points.append({"dte": dte, "expiration": exp, "atm_iv": round(atm_iv, 4)})

            if not points:
                return None
            points.sort(key=lambda p: p["dte"])

            near_iv = points[0]["atm_iv"]
            far_iv = points[-1]["atm_iv"]
            slope = far_iv - near_iv
            rel = slope / near_iv if near_iv > 0 else 0.0
            if rel > self._TERM_FLAT_REL:
                state = "contango"
            elif rel < -self._TERM_FLAT_REL:
                state = "backwardation"
            else:
                state = "flat"

            return {
                "points": points,
                "state": state,
                "near_iv": round(near_iv, 4),
                "far_iv": round(far_iv, 4),
                "slope": round(slope, 4),
            }
        except Exception as e:
            logger.error(f"Term structure: computation failed: {e}")
            return None