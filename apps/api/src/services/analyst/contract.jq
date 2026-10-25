# Spec 06 criterion 6: every fact in a Q1 package obeys the contract.
# Run: jq -e -f apps/api/src/services/analyst/contract.jq PACKAGE.json
# Prints the failures (an empty list when it passes), then true or false; -e exits 1 on false.
# An id splits on its first three colons: source, series, key (no series or key holds a colon).
. as $p
| [$p.sections[].facts[]] as $facts
| ($facts | map(.id)) as $ids
| def series: split(":")[1];
  def key: split(":")[2];
  ($facts | map(select(.id | series == "13f.managers_holding")) | first) as $holding
| (if $holding then ($holding.id | key | .[-10:]) else null end) as $quarter
| [
    ($facts[] | select(.source.licence != "reuse_permitted") | "licence: \(.id)"),
    ($facts[] | select(.state as $s | ["updated", "delayed", "computed"] | index($s) | not) | "state: \(.id)"),
    ($facts[] | select(.as_of > $p.cutoff) | "as_of after the cutoff: \(.id)"),
    ($p.sections.filings.facts[], $p.sections.insider_trades.facts[]
      | select(.as_of <= $p.since) | "as_of not after since: \(.id)"),
    (if ($ids | length) != ($ids | unique | length) then "ids are not unique" else empty end),
    ($facts[] | .id as $id | (.derived_from // [])[] | select(. as $d | $ids | index($d) | not)
      | "\($id) cites \(.), which the package doesn't hold"),
    ($facts[] | select(.state == "computed" and ((.derived_from // []) | length) == 0 and .value != 0)
      | "computed with nothing cited but not zero: \(.id)"),
    ($facts[] | select(.state == "computed" and (has("derived_from") | not)) | "computed without derived_from: \(.id)"),
    (($facts | map(select(.id | series == "insider.form4_read")) | first) as $read
      | ($facts | map(select(.id | series == "form4")) | length) as $n
      | if $read == null then "no insider.form4_read fact"
        elif $read.value != $n then "insider.form4_read is \($read.value), form4 facts \($n)"
        else empty end),
    (if $holding == null then "no 13f.managers_holding fact"
     else ($facts | map(select((.id | series) == "13f.shares" and (.id | key | endswith("." + $quarter)))) | length) as $n
       | if $holding.value != $n then "13f.managers_holding is \($holding.value), 13f.shares at \($quarter) \($n)" else empty end
     end),
    (($facts | map(select(.id | series == "13f.total_pct")) | first) as $total
      | $facts[] | select(.id | series == "13f.pct")
      | select($total == null or ((.id) as $id | $total.derived_from | index($id) | not))
      | "13f.pct not cited by 13f.total_pct: \(.id)")
  ]
| ., length == 0
