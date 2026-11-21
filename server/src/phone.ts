const LOCAL_MOBILE = /^[789]\d{9}$/;

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  let local: string;
  if (digits.length === 11 && digits.startsWith('0')) local = digits.slice(1);
  else if (digits.length === 13 && digits.startsWith('234')) local = digits.slice(3);
  else if (digits.length === 10) local = digits;
  else return null;
  return LOCAL_MOBILE.test(local) ? `+234${local}` : null;
}
