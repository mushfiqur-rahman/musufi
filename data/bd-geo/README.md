# Bangladesh areas

Used by the address picker in the order form (division → district →
upazila/thana → union, or Dhaka city thana → post office).

- **Source:** [nuhil/bangladesh-geocode](https://github.com/nuhil/bangladesh-geocode),
  MIT License (see `LICENSE` in this folder), downloaded 2026-11-27.
- **`areas.json`**: `divisions` `[id, bn, en]`, `districts` `[id, divisionId, bn, en]`,
  `upazilas` `[id, districtId, bn, en]`, and `cityThanas`
  `[id, districtId, bn, en, [[postOffice, postcode], …]]` for Dhaka North and
  South City Corporations. City thana ids start at 9001 so they never clash
  with upazila ids; their Bangla names were added by hand (the source has
  English only).
- **`unions.json`**: `{ upazilaId: [[id, bn, en], …] }`, 4,540 unions. Served per
  upazila by `/api/geo/unions/[upazila]` so the page doesn't load all of them.

To refresh: download the same four JSON files plus `postcodes.json` from the
source and rerun the conversion (see git history of this folder).
