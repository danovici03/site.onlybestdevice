/**
 * Numeralul românesc cere „de" înaintea substantivului când ultimele două cifre
 * sunt 00 sau de la 20 în sus: „19 rezultate", dar „20 de rezultate", „101
 * rezultate", „120 de rezultate".
 */
export const countWithNoun = (count: number, noun: string): string => {
  const lastTwo = Math.abs(count) % 100
  const needsDe = lastTwo === 0 || lastTwo >= 20
  return `${count}${needsDe ? " de" : ""} ${noun}`
}
