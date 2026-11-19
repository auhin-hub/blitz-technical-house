/**
 * The studio's starting cockpit: an EXAMPLE reclined FS-style layout so the
 * drawing shows something sensible on first open. Every number is meant to be
 * replaced with the team's CAD hardpoints — the page says so.
 */
import type { Cockpit } from './geometry';

export const EXAMPLE_COCKPIT: Cockpit = {
  frontHoopTop: { x: 650, z: 730 },
  mainHoopTop: { x: 1660, z: 1190 },
  mainBraceLow: { x: 2120, z: 380 },
  seatJunction: { x: 1080, z: 110 },
  seatPanDeg: 12,
  seatBackDeg: 40,
  headRestraint: { x: 1560, z: 900 },
  pedalFace: { x: 60, z: 260 },
  pedalDeg: 55,
  heel: { x: 190, z: 110 },
  wheelCentre: { x: 820, z: 600 },
  wheelDia: 250,
  wheelTiltDeg: 20,
  shoulderMount: { x: 1660, z: 640 },
  lapMount: { x: 1090, z: 20 },
};

/** Labels + order for the cockpit inputs (points as x/z pairs, then angles). */
export const COCKPIT_POINTS: { key: keyof Cockpit; label: string; hint: string }[] = [
  { key: 'frontHoopTop', label: 'Front hoop top', hint: 'rear surface, top' },
  { key: 'mainHoopTop', label: 'Main hoop top', hint: 'rear surface, top' },
  { key: 'mainBraceLow', label: 'Main-hoop brace, lower end', hint: 'rearward bracing if x > main hoop' },
  { key: 'seatJunction', label: 'Seat back / bottom junction', hint: 'seat surface, seat rearmost' },
  { key: 'headRestraint', label: 'Head restraint front face', hint: 'pad face, centre' },
  { key: 'pedalFace', label: 'Pedal face', hint: 'rearmost actuation face, pedals frontmost' },
  { key: 'heel', label: 'Heel rest', hint: 'pedals frontmost' },
  { key: 'wheelCentre', label: 'Steering-wheel centre', hint: '' },
  { key: 'shoulderMount', label: 'Shoulder-harness mount', hint: 'side view' },
  { key: 'lapMount', label: 'Lap-belt mount', hint: 'side view' },
];
export const COCKPIT_SCALARS: { key: keyof Cockpit; label: string; unit: string }[] = [
  { key: 'seatPanDeg', label: 'Seat bottom angle (rising to the front)', unit: '°' },
  { key: 'seatBackDeg', label: 'Seat back angle from vertical', unit: '°' },
  { key: 'pedalDeg', label: 'Foot / pedal angle above horizontal', unit: '°' },
  { key: 'wheelDia', label: 'Steering-wheel diameter', unit: 'mm' },
  { key: 'wheelTiltDeg', label: 'Wheel tilt from vertical (top toward driver)', unit: '°' },
];
