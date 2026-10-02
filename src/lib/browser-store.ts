const TOKEN = "offhand.token";
const UNTIL = "offhand.until";

export function readPass() {
  if (typeof window === "undefined") return { token: "", until: "" };
  return {
    token: localStorage.getItem(TOKEN) ?? "",
    until: localStorage.getItem(UNTIL) ?? "",
  };
}

export function savePass(token: string, until: string) {
  localStorage.setItem(TOKEN, token);
  localStorage.setItem(UNTIL, until);
}
