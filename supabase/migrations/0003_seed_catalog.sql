insert into series_catalog
  (series_id, description, raw_unit, canonical_unit, frequency, source_name, publication_lag_days, notes)
values
  ('DOM_SOY_MANDI',  'Modal price per mandi; dimension_key = lower(state|market)', 'INR per quintal', 'INR/t', 'daily',  'data.gov.in Agmarknet [VERIFY]', 0, null),
  ('DOM_SOY_BENCH',  'Domestic benchmark: median of selected mandis',              'INR/t',           'INR/t', 'daily',  'derived',                        0, 'rebuilt after ingest'),
  ('DOM_SOY_ARRIVAL','Arrivals per mandi per day',                                 'unknown [VERIFY]','t',     'daily',  'data.gov.in Agmarknet [VERIFY]', 0, 'optional'),
  ('INT_FUT_SOY',    'Nearby soybean futures price',                               'US cents per bushel','USD/t','daily', 'public futures feed [VERIFY provider]', 0, 'record roll treatment in docs/data-sources.md'),
  ('INT_WB_SOY',     'Monthly soybean price',                                      'USD/t',           'USD/t', 'monthly','World Bank commodity data [VERIFY]', 35, 'lag is a conservative default'),
  ('FX_USDINR',      'INR per 1 USD',                                              'INR per USD',     'INR per USD','daily','FX source [VERIFY]',          0, null);
