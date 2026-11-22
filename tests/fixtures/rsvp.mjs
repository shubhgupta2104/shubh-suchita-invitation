export const prefilledForm = "https://docs.google.com/forms/d/e/1FAIpQLSf_344lGr0NDc0JVhV59THlmWfkQJUz_X-Tk1L3YIpR10HnkA/viewform?usp=pp_url&entry.399782158=2027-01-25+10:00";

const embedded = new URL(prefilledForm);
embedded.searchParams.set("embedded", "true");
export const embeddedForm = embedded.href;
