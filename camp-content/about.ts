// The longer About text on the applicant home. Another camp swaps this file.
import { CAMP_NAME } from "../src/lib/camp";

export const ABOUT_BANNER = "Dust, shade, music and good people.";

export const ABOUT_BLOCKS = [
  {
    title: "Who we are",
    body: `${CAMP_NAME} is a theme camp at Burning Man in Black Rock City, Nevada: about 70 people who build a shady, friendly home on the playa and share it with everyone who walks past.`,
  },
  {
    pack: "mutant-vehicle",
    title: "The art car",
    body: "Our roaming art car carries the music. It parks at a sunset link-up with another camp and at a night spot, then comes home. Crew, DJs and decorators all have a place on it.",
  },
  {
    title: "How we work",
    body: "Everyone builds, everyone takes shifts, everyone helps strike and leave no trace. In return: a kitchen that feeds you, a quiet zone to sleep in, and a crew that has your back.",
  },
] as const satisfies readonly { title: string; body: string; pack?: string }[];
