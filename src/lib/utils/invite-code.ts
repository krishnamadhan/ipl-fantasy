const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // removed ambiguous 0/O, 1/I

export function generateInviteCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}
