// Burning Man 2027 (Black Rock City, Nevada): the camp-lead year, from the Statement of Intent to
// the Post-playa Report. The event dates are official (burningman.org/black-rock-city/
// black-rock-city-2027/). Ticket-sale, Gate and Exodus times for 2027 aren't posted yet, so those
// entries are marked "pattern": the 2026 date moved to the same weekday in 2027. Check Burner
// Profile and the linked page before relying on one, and flip it to "official" once posted.
import { defineEventPack } from "../../src/lib/event-packs";

const BM = "https://burningman.org/black-rock-city";
const HELP = "https://help.burningman.org/hc/en-us/articles";
const PLACEMENT = `${BM}/camps/placement-process/`;
const SOI = `${HELP}/4410598647316-Theme-Camp-Statement-of-Intent-SOI-and-Stewards-Sale-Tickets`;
const STEWARDS = `${HELP}/34445848189076-What-is-the-Stewards-Sale-Who-is-eligible`;
const SAP = `${HELP}/4415067257236-Setup-Access-Passes`;
const TICKETS = `${BM}/ticketing-information/`;
const EXODUS = `${BM}/preparation/getting-there-and-back/exodus/`;
const EVENT = `${BM}/black-rock-city-2027/`;

export default defineEventPack({
  key: "burning-man",
  label: "Burning Man",
  place: "Black Rock City, Nevada",
  timezone: "America/Los_Angeles",
  timezoneLabel: "PT",
  dateStyle: "us",
  currency: "USD",
  year: 2027,
  event: { start: "2027-08-29", end: "2027-09-06", status: "official", source: EVENT },
  calendar: [
    {
      key: "soi_opens",
      label: "Statement of Intent opens",
      detail:
        "Placement opens the Statement of Intent in Burner Profile; camp standing is announced.",
      date: "2026-12-15",
      status: "pattern",
      source: SOI,
    },
    {
      key: "soi_due",
      label: "Statement of Intent due",
      detail: "File it in Burner Profile. Placed camps need it for Stewards Sale tickets.",
      date: "2027-01-14",
      time: "12:00 PT",
      status: "pattern",
      source: SOI,
    },
    {
      key: "sunrise_sale",
      label: "Sunrise Sale",
      detail: "Registration, then the sale. Members who need a ticket register now.",
      date: "2027-01-25",
      until: "2027-02-03",
      status: "pattern",
      source: TICKETS,
    },
    {
      key: "stewards_allocations",
      label: "Stewards Sale allocations",
      detail: "Returning camps hear how many Stewards tickets they get; new camps hear if placed.",
      date: "2027-02-15",
      status: "pattern",
      source: STEWARDS,
    },
    {
      key: "stewards_form",
      label: "Stewards Sale: name who gets access",
      detail: "Submit the names of the core crew who get the camp's Stewards Sale access.",
      date: "2027-02-19",
      until: "2027-02-26",
      status: "pattern",
      source: STEWARDS,
    },
    {
      key: "stewards_purchase",
      label: "Stewards Sale purchase window",
      detail: "Named members buy their Stewards tickets. Unused access can't be passed on.",
      date: "2027-03-03",
      until: "2027-04-19",
      status: "pattern",
      source: STEWARDS,
    },
    {
      key: "questionnaire_due",
      label: "Placed Camp Questionnaire due",
      detail:
        "Size, frontage, interactivity, power and sound. Check the exact Thursday in Burner Profile.",
      date: "2027-03-18",
      time: "12:00 PT",
      status: "pattern",
      source: PLACEMENT,
    },
    {
      key: "sap_request",
      label: "Setup Access Pass request",
      detail: "Ask Placement for early-arrival passes by day, for the build crew only.",
      date: "2027-04-15",
      status: "pattern",
      source: SAP,
    },
    {
      key: "main_sale",
      label: "Main Sale",
      detail: "The big public ticket sale. Anyone still without a ticket tries here.",
      date: "2027-04-28",
      status: "pattern",
      source: TICKETS,
    },
    {
      key: "placement_results",
      label: "Placement results",
      detail: "Placement tells camps whether they're placed.",
      date: "2027-05-15",
      status: "pattern",
      source: PLACEMENT,
    },
    {
      key: "whatwherewhen_deadline",
      label: "WhatWhereWhen print deadline",
      detail: "Last day to list the camp's events in the printed guide.",
      date: "2027-06-24",
      status: "pattern",
      source: `${HELP}/4415060119956-WhatWhereWhen`,
    },
    {
      key: "saps_emailed",
      label: "Setup Access Passes and neighbors",
      detail: "Passes are emailed to holders; neighbors and approximate address are announced.",
      date: "2027-07-15",
      status: "pattern",
      source: SAP,
    },
    {
      key: "box_office_early",
      label: "Box Office opens for pass holders",
      detail: "Setup Access Pass holders pick up Will Call tickets and drive in for build.",
      date: "2027-08-23",
      time: "09:00 PT",
      status: "pattern",
      source: SAP,
    },
    {
      key: "gates_open",
      label: "Gates open",
      detail: "Gates open to everyone at 12:01am Sunday. Camp built by Monday.",
      date: "2027-08-29",
      time: "00:01 PT",
      status: "official",
      source: EVENT,
    },
    {
      key: "man_burn",
      label: "The Man burns",
      detail: "Saturday night of burn week.",
      date: "2027-09-04",
      status: "pattern",
      source: EVENT,
    },
    {
      key: "temple_burn",
      label: "Temple burn",
      detail: "Sunday, about 8pm.",
      date: "2027-09-05",
      status: "pattern",
      source: EVENT,
    },
    {
      key: "event_ends",
      label: "Event ends",
      detail: "Last official day. Strike and the final MOOP sweep run alongside Exodus.",
      date: "2027-09-06",
      status: "official",
      source: EVENT,
    },
    {
      key: "off_playa",
      label: "Off playa (end of Exodus)",
      detail:
        "Camps should be gone by Tuesday noon. Spread departures: Exodus waits reach 6 to 9 hours.",
      date: "2027-09-07",
      time: "12:00 PT",
      status: "pattern",
      source: EXODUS,
    },
    {
      key: "post_playa_report",
      label: "Post-playa Report",
      detail: "Report on the camp, with day and night frontage photos. Feeds next year's standing.",
      date: "2027-09-15",
      until: "2027-10-15",
      status: "pattern",
      source: PLACEMENT,
    },
  ],
  rules: [
    {
      key: "ten_principles",
      label: "The 10 Principles",
      summary:
        "Radical inclusion, gifting, decommodification, self-reliance, self-expression, communal effort, civic responsibility, leaving no trace, participation and immediacy.",
      source: "https://burningman.org/about-us/10-principles/",
    },
    {
      key: "leave_no_trace",
      label: "Leave No Trace and MOOP",
      summary:
        "Pack out everything, sweep the site in lines, pull every stake and lag bolt. The MOOP Map score affects next year's placement.",
      source: `${BM}/preparation/leaving-no-trace/moop/`,
    },
    {
      key: "no_selling",
      label: "No selling, no turnkey camps",
      summary:
        "Dues share real costs only. No paid spots, meal plans for sale or all-inclusive packages.",
      source: `${BM}/camps/cultural-direction-setting-decommodification/commodification-gifting-decommodification-and-participation/`,
    },
    {
      key: "setup_access_passes",
      label: "Setup Access Passes are for the build crew",
      summary:
        "Only people building camp arrive early, and the camp answers for every pass it requests.",
      source: SAP,
    },
    {
      key: "vehicle_passes",
      label: "Vehicle passes",
      summary:
        "Every motor vehicle driving in needs a vehicle pass bought in advance (motorcycles and towed trailers excepted).",
      source: `${HELP}/360025856692-Who-needs-to-have-a-Vehicle-Pass`,
    },
    {
      key: "stewards_sale",
      label: "Stewards Sale tickets",
      summary:
        "Placed camps get Stewards Sale access for their core crew. The camp decides who, by a written policy.",
      source: STEWARDS,
    },
    {
      key: "exodus",
      label: "Exodus",
      summary:
        "Plan departures across the days after the burn and keep a crew until the final sweep.",
      source: EXODUS,
    },
    {
      key: "fire",
      label: "Fire in camp",
      summary:
        "Burn barrels raised off the playa, a fire extinguisher and a sober tender, and a clear zone around flames.",
      source: `${BM}/bring-your-art/fire-art-guidelines/fire-in-theme-camps-2/`,
    },
    {
      key: "gray_water",
      label: "Gray water",
      summary: "No dumping on the playa: evaporate or haul out every drop.",
      source: `${BM}/preparation/camping-tips/gray-water/`,
    },
    {
      key: "sound",
      label: "Sound policy",
      summary: "Large sound sits in the 2:00 and 10:00 zones with speakers facing the open playa.",
      source: `${BM}/preparation/infrastructure/sound-policy/`,
    },
  ],
  obligations: [],
  sections: [{ key: "obligations", label: "Burning Man deadlines" }],
});
