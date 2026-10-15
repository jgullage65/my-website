import type { BusinessIdentity, Match } from "./contracts";
const normalized = (s?: string) =>
  (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const name = (s?: string) =>
  normalized(s)
    .replace(/\b(?:incorporated|inc|llc|ltd|limited|corp|corporation)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
const street = (s?: string) =>
  normalized(s)
    .replace(/\bstreet\b/g, "st")
    .replace(/\broad\b/g, "rd")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\bdrive\b/g, "dr");
const region = (s?: string) => normalized(s).replace(/^us /, "").replace(/^washington$/, "wa");
const domain = (s?: string) => {
  try {
    return new URL(s!.includes("://") ? s! : "https://" + s).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
};
export function matchBusiness(
  target: BusinessIdentity,
  candidate: BusinessIdentity,
): Match {
  const signals: string[] = [],
    reject = (reason: string): Match => ({
      classification: "rejected",
      signals: [...signals, reason],
    });
  if (!name(target.name) || !name(candidate.name))
    return {
      classification: "insufficient_evidence",
      signals: ["missing_business_name"],
    };
  const exactName = name(target.name) === name(candidate.name) || !!candidate.formerNames?.some(n => name(n) === name(target.name));
  const former = target.formerNames?.some(
    (n) => name(n) === name(candidate.name),
  );
  signals.push(
    exactName
      ? "normalized_name_equal"
      : former
        ? "former_name_equal"
        : "name_differs",
  );
  if (!exactName && !former) return reject("name_not_confirmed");
  if (
    target.branch &&
    candidate.branch &&
    normalized(target.branch) !== normalized(candidate.branch)
  )
    return reject("branch_conflict");
  if (
    target.registrationId &&
    candidate.registrationId &&
    target.registrationAuthority &&
    candidate.registrationAuthority &&
    normalized(target.registrationAuthority) ===
      normalized(candidate.registrationAuthority)
  ) {
    if (
      normalized(target.registrationId) !== normalized(candidate.registrationId)
    )
      return reject("registration_identifier_conflict");
    signals.push("registration_identifier_equal");
    // A registry can identify the legal entity while still not identifying a requested branch.
    // Location conflicts below still reject a legal entity record from another branch or a former address.
  }
  const country = (s?: string) => normalized(s).replace(/^(?:usa|united states(?: of america)?)$/, "us");
  if (target.country && candidate.country && country(target.country) !== country(candidate.country)) return reject("country_conflict");
  for (const key of ["city"] as const)
    if (
      target[key] &&
      candidate[key] &&
      normalized(target[key]) !== normalized(candidate[key])
    )
      return reject(key + "_conflict");
  const zip = (v?: string) => /^(?:\d{5})(?:-\d{4})?$/.test(v ?? "") && (target.country === "US" || candidate.country === "US") ? v!.slice(0,5) : normalized(v);
  if (target.postalCode && candidate.postalCode && zip(target.postalCode) !== zip(candidate.postalCode)) return reject("postalCode_conflict");
  if (
    target.state &&
    candidate.state &&
    region(target.state) !== region(candidate.state)
  )
    return reject("state_conflict");
  if (
    target.address &&
    candidate.address &&
    street(target.address) !== street(candidate.address)
  )
    return reject("street_address_conflict_or_moved");

  const address =
    !!target.address &&
    !!candidate.address &&
    street(target.address) === street(candidate.address);
  const locality =
    !!target.city &&
    !!candidate.city &&
    normalized(target.city) === normalized(candidate.city) &&
    !!target.state &&
    !!candidate.state &&
    region(target.state) === region(candidate.state);
  const phoneDigits = (value?: string) => {
    const digits = (value ?? "").replace(/\D/g, "");
    return digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  };
  const targetPhone = phoneDigits(target.phone), candidatePhone = phoneDigits(candidate.phone);
  const phone = /^\d{10,15}$/.test(targetPhone) && targetPhone === candidatePhone;
  const sameDomain =
    !!domain(target.website) &&
    domain(target.website) === domain(candidate.website);
  if (address) signals.push("street_address_equal");
  if (locality) signals.push("city_and_region_equal");
  if (phone) signals.push("phone_equal");
  if (sameDomain) signals.push("website_domain_equal");
  // Name+domain alone identifies a chain, not a location. Never merge branch claims on that basis.
  if (
    address &&
    locality &&
    (!target.branch ||
      normalized(target.branch) === normalized(candidate.branch))
  )
    return { classification: "confirmed", scope: "business_location", signals };
  if (phone && locality && !target.branch)
    return { classification: "confirmed", scope: "legal_entity", signals: [...signals, "phone_does_not_confirm_establishment"] };
  if (signals.includes("registration_identifier_equal")) return { classification: "confirmed", scope: "legal_entity", signals: [...signals, "legal_entity_only_not_branch_confirmation"] };
  return {
    classification:
      address || locality || sameDomain ? "ambiguous" : "insufficient_evidence",
    signals: [...signals, "requires_branch_specific_address_or_identifier"],
  };
}
