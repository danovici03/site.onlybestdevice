/**
 * Perioada campaniei Black Friday. Aici e singurul loc unde se schimbă datele:
 * numărătoarea și textele paginii se iau de aici.
 *
 * Offsetul e scris explicit (+02:00, ora României iarna), ca intervalul să fie
 * același indiferent de fusul serverului sau al clientului.
 *
 * Titlul și datele trebuie să rămână aliniate cu price list-ul creat de
 * `backend/src/scripts/seed-black-friday-price-list.ts`.
 */
export const BLACK_FRIDAY = {
  start: new Date("2026-11-27T00:00:00+02:00").getTime(),
  end: new Date("2026-11-30T23:59:59+02:00").getTime(),
  dates: "27–30 noiembrie",
  priceList: "Black Friday",
}

export type BlackFridayPhase = "upcoming" | "live" | "ended"

export const getBlackFridayPhase = (now: number): BlackFridayPhase => {
  if (now < BLACK_FRIDAY.start) return "upcoming"
  return now <= BLACK_FRIDAY.end ? "live" : "ended"
}
