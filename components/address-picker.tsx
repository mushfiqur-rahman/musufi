"use client";

// Structured delivery address: বিভাগ → জেলা → উপজেলা/থানা → ইউনিয়ন/পোস্ট অফিস,
// then a free-text line for village/area, road and house. Changing a level
// clears the levels below it. Unions load per upazila from /api/geo/unions.

import { useEffect, useState } from "react";
import { DIVISIONS, districtsOf, findUpazila, upazilasOf, zoneForDistrict } from "@/lib/geo";
import { site, taka } from "@/lib/site";

export type AddressValue = {
  divisionId: number | "";
  districtId: number | "";
  upazilaId: number | "";
  localId: number | "";
  line: string;
};

export const emptyAddress: AddressValue = { divisionId: "", districtId: "", upazilaId: "", localId: "", line: "" };

export type AddressErrors = Partial<Record<keyof AddressValue, string>>;

/** Client-side completeness check; the server validates everything again. */
export function checkAddress(a: AddressValue): AddressErrors {
  const e: AddressErrors = {};
  if (!a.divisionId) e.divisionId = "বিভাগ বেছে নিন";
  if (!a.districtId) e.districtId = "জেলা বেছে নিন";
  if (!a.upazilaId) e.upazilaId = "উপজেলা বা থানা বেছে নিন";
  if (a.line.trim().length < 5) e.line = "গ্রাম/এলাকা, রাস্তা আর বাসার নম্বর লিখুন";
  return e;
}

export function AddressPicker({ id, value, onChange, errors, disabled }: { id: string; value: AddressValue; onChange: (v: AddressValue) => void; errors: AddressErrors; disabled?: boolean }) {
  const [unions, setUnions] = useState<[number, string][] | null>(null);
  const upazila = value.upazilaId ? findUpazila(value.upazilaId) : undefined;

  // Load unions for a (non-city) upazila.
  useEffect(() => {
    if (!upazila || upazila.city) return;
    let alive = true;
    fetch(`/api/geo/unions/${upazila.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list: [number, string][]) => alive && setUnions(list))
      .catch(() => alive && setUnions([]));
    return () => { alive = false; setUnions(null); };
  }, [upazila]);

  const set = (patch: Partial<AddressValue>) => onChange({ ...value, ...patch });
  const err = (k: keyof AddressValue) => errors[k] ? <span className="err" id={`${id}-${k}-err`}>{errors[k]}</span> : null;
  const aria = (k: keyof AddressValue) => ({ "aria-invalid": Boolean(errors[k]), "aria-describedby": errors[k] ? `${id}-${k}-err` : undefined });
  const zone = value.districtId ? zoneForDistrict(value.districtId) : null;

  return (
    <fieldset className="field address-picker" disabled={disabled}>
      <legend>ডেলিভারির ঠিকানা</legend>
      <div className="addr-grid">
        <label className="mini-field">
          <span>বিভাগ</span>
          <select id={`${id}-divisionId`} value={value.divisionId} onChange={(e) => onChange({ ...emptyAddress, line: value.line, divisionId: Number(e.target.value) || "" })} {...aria("divisionId")}>
            <option value="">বেছে নিন</option>
            {DIVISIONS.map((d) => <option key={d.id} value={d.id}>{d.bn}</option>)}
          </select>
          {err("divisionId")}
        </label>
        <label className="mini-field">
          <span>জেলা</span>
          <select id={`${id}-districtId`} value={value.districtId} disabled={!value.divisionId} onChange={(e) => set({ districtId: Number(e.target.value) || "", upazilaId: "", localId: "" })} {...aria("districtId")}>
            <option value="">বেছে নিন</option>
            {value.divisionId !== "" && districtsOf(value.divisionId).map((d) => <option key={d.id} value={d.id}>{d.bn}</option>)}
          </select>
          {err("districtId")}
        </label>
        <label className="mini-field">
          <span>উপজেলা / থানা</span>
          <select id={`${id}-upazilaId`} value={value.upazilaId} disabled={!value.districtId} onChange={(e) => set({ upazilaId: Number(e.target.value) || "", localId: "" })} {...aria("upazilaId")}>
            <option value="">বেছে নিন</option>
            {value.districtId !== "" && (() => {
              const list = upazilasOf(value.districtId);
              const city = list.filter((u) => u.city);
              const rural = list.filter((u) => !u.city);
              return (
                <>
                  {city.length > 0 && <optgroup label="ঢাকা শহরের থানা">{city.map((u) => <option key={u.id} value={u.id}>{u.bn}</option>)}</optgroup>}
                  <optgroup label={city.length ? "উপজেলা" : "উপজেলা"}>{rural.map((u) => <option key={u.id} value={u.id}>{u.bn}</option>)}</optgroup>
                </>
              );
            })()}
          </select>
          {err("upazilaId")}
        </label>
        <label className="mini-field">
          <span>{upazila?.city ? "পোস্ট অফিস (ঐচ্ছিক)" : "ইউনিয়ন (ঐচ্ছিক)"}</span>
          <select id={`${id}-localId`} value={value.localId} disabled={!upazila || (!upazila.city && unions === null)} onChange={(e) => set({ localId: e.target.value === "" ? "" : Number(e.target.value) })}>
            <option value="">{!upazila ? "আগে উপজেলা বেছে নিন" : !upazila.city && unions === null ? "লোড হচ্ছে..." : "বেছে নিন"}</option>
            {upazila?.city
              ? upazila.postOffices.map((p, i) => <option key={p.code + p.name} value={i}>{p.name} ({p.code})</option>)
              : (unions ?? []).map(([uid, bn]) => <option key={uid} value={uid}>{bn}</option>)}
          </select>
        </label>
      </div>
      <label className="mini-field">
        <span>গ্রাম/মহল্লা, রাস্তা, বাসার নম্বর</span>
        <textarea id={`${id}-line`} value={value.line} onChange={(e) => set({ line: e.target.value })} maxLength={200} placeholder="যেমন: বাসা ১২, রোড ৫, ব্লক সি, শ্যামলী" autoComplete="address-line1" {...aria("line")} />
        {err("line")}
      </label>
      {zone && (
        <p className="zone-note ok-note">
          ডেলিভারি: {site.delivery[zone].label} · {taka(site.delivery[zone].fee)} · {site.delivery[zone].days}
        </p>
      )}
    </fieldset>
  );
}
