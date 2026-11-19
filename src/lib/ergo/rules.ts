/**
 * Cockpit / driver rules per competition, for the Cockpit Packaging Studio.
 *
 * Every number here was read from the named rulebook edition (rule numbers
 * cited). Where a value could NOT be confirmed from the source, `unverified`
 * lists it — the UI shows those checks as "unverified", never as a pass.
 * The rulebook PDFs are copyrighted and are not stored in this repo; check the
 * current edition before a design freeze. Rules change every season.
 */

export type RuleId = 'fsae' | 'fsuk' | 'fsj' | 'fsc';

export interface CockpitRules {
  id: RuleId;
  name: string;
  edition: string;
  /** What the edition is and where it came from — shown in the UI. */
  source: string;
  /** 95th-percentile male template ("Percy"). */
  percy: {
    hipDia: number;          // mm — hips and buttocks circle
    shoulderDia: number;     // mm — shoulder / cervical circle
    headDia: number;         // mm — head with helmet
    hipToShoulder: number;   // mm — centre to centre of the two 200 mm circles
    shoulderToHead: number;  // mm — upper 200 mm centre to the 300 mm centre
    minHipToPedal: number;   // mm — lower circle centre to rearmost pedal face (pedals forward)
    headToRestraint: number; // mm — head circle to head restraint
    headToRestraintMode: 'max' | 'exact'; // "no more than" vs "positioned … away"
    ref: string;
  };
  /** Helmet (Percy + every team driver) to the roll-hoop lines. */
  helmetClearance: { min: number; ref: string };
  /** Upright if the line joining the two 200 mm circles is ≤ this from vertical. */
  uprightMaxFromVertical: { deg: number; ref: string };
  lapBelt: {
    upright: [number, number];      // deg to horizontal, side view
    reclined: [number, number];
    seatBottomFwd: [number, number]; // mm forward of seat back / seat bottom junction ("should")
    ref: string;
  };
  shoulderBelt: {
    angle: [number, number];         // deg: [-below, +above] horizontal, shoulders → mount
    spacing: [number, number];       // mm centre to centre (not drawable in side view; shown)
    ref: string;
  };
  headRestraintGap: { max: number; ref: string };  // per driver, to back of helmet
  steeringToFrontHoop: { max: number; ref: string }; // wheel rim rearward of front hoop
  egress: { maxS: number; ref: string };
  /** Keys of values above that could not be confirmed from the source text. */
  unverified: string[];
}

export const RULES: Record<RuleId, CockpitRules> = {
  fsae: {
    id: 'fsae',
    name: 'Formula SAE (FSAE)',
    edition: 'Formula SAE Rules 2027 V1.0 (1 Sept 2026)',
    source: 'SAE International rulebook, read directly.',
    percy: {
      hipDia: 200, shoulderDia: 200, headDia: 300, hipToShoulder: 490, shoulderToHead: 280,
      minHipToPedal: 915, headToRestraint: 25, headToRestraintMode: 'max',
      ref: 'F.5.6.5–F.5.6.6',
    },
    helmetClearance: { min: 50, ref: 'F.5.6 Roll Hoop and Driver Position' },
    uprightMaxFromVertical: { deg: 30, ref: 'T.2.1 d/e' },
    lapBelt: { upright: [45, 65], reclined: [60, 80], seatBottomFwd: [0, 75], ref: 'T.2.5' },
    shoulderBelt: { angle: [-20, 10], spacing: [175, 235], ref: 'T.2.6' },
    headRestraintGap: { max: 25, ref: 'T.2.8 (Head Restraint)' },
    steeringToFrontHoop: { max: 250, ref: 'F.5.8 Front Hoop' },
    egress: { maxS: 5, ref: 'IN.9.3' },
    unverified: [],
  },
  fsuk: {
    id: 'fsuk',
    name: 'Formula Student UK (FS Rules)',
    edition: 'Formula Student Rules 2026 v1.0 (FSG, used by FS UK / IMechE)',
    source: 'formulastudent.de FS-Rules_2026_v1.0, read directly. Check IMechE for the current version.',
    percy: {
      hipDia: 200, shoulderDia: 200, headDia: 300, hipToShoulder: 490, shoulderToHead: 280,
      minHipToPedal: 915, headToRestraint: 25, headToRestraintMode: 'exact',
      ref: 'T 4.3.4',
    },
    helmetClearance: { min: 50, ref: 'T 4.3 (Percy)' },
    uprightMaxFromVertical: { deg: 30, ref: 'T 5 definitions' },
    lapBelt: { upright: [45, 65], reclined: [60, 80], seatBottomFwd: [0, 76], ref: 'T 5.4' },
    shoulderBelt: { angle: [-20, 10], spacing: [180, 230], ref: 'T 5.5' },
    headRestraintGap: { max: 25, ref: 'T 5.7' },
    steeringToFrontHoop: { max: 250, ref: 'T 2.8 Steering' },
    egress: { maxS: 5, ref: 'T 4.11.1 ("less than 5 s")' },
    unverified: [],
  },
  fsj: {
    id: 'fsj',
    name: 'Formula SAE Japan (FSAEJ)',
    edition: 'FSAEJ 2026 — runs on Formula SAE Rules 2026 + JSAE local rules',
    source:
      'JSAE states the event follows Formula SAE Rules 2026, with its participation and local rules taking precedence. ' +
      'Values below are the FSAE values; the JSAE local-rule PDFs could not be fetched to check for overrides.',
    percy: {
      hipDia: 200, shoulderDia: 200, headDia: 300, hipToShoulder: 490, shoulderToHead: 280,
      minHipToPedal: 915, headToRestraint: 25, headToRestraintMode: 'max',
      ref: 'FSAE F.5.6.5–6',
    },
    helmetClearance: { min: 50, ref: 'FSAE F.5.6' },
    uprightMaxFromVertical: { deg: 30, ref: 'FSAE T.2.1' },
    lapBelt: { upright: [45, 65], reclined: [60, 80], seatBottomFwd: [0, 75], ref: 'FSAE T.2.5' },
    shoulderBelt: { angle: [-20, 10], spacing: [175, 235], ref: 'FSAE T.2.6' },
    headRestraintGap: { max: 25, ref: 'FSAE T.2.8' },
    steeringToFrontHoop: { max: 250, ref: 'FSAE F.5.8' },
    egress: { maxS: 5, ref: 'FSAE IN.9.3' },
    unverified: ['JSAE local rules not checked — add the 2026 FSAEJ LocalRule PDF to confirm'],
  },
  fsc: {
    id: 'fsc',
    name: 'Formula Student China (FSC)',
    edition: 'FSC 2023 rulebook (CSAE, Chinese) — newest edition found',
    source:
      'CSAE 2023 edition, based on the FSAE rules with FS Germany additions. Read via text extraction; ' +
      'Chinese characters did not extract, numbers did. Uses inch-based clearances (2 in / 1 in).',
    percy: {
      hipDia: 200, shoulderDia: 200, headDia: 300, hipToShoulder: 490, shoulderToHead: 280,
      minHipToPedal: 915, headToRestraint: 25.4, headToRestraintMode: 'max',
      ref: '3.10.5–3.10.6',
    },
    helmetClearance: { min: 50.8, ref: '3.10.5 (2 in)' },
    uprightMaxFromVertical: { deg: 30, ref: '5.x definitions' },
    lapBelt: { upright: [45, 65], reclined: [60, 80], seatBottomFwd: [0, 76], ref: '5.3.5–5.3.6' },
    shoulderBelt: { angle: [-20, 10], spacing: [175, 235], ref: '5.4.4–5.4.5' },
    headRestraintGap: { max: 25.4, ref: '5.x head restraint' },
    steeringToFrontHoop: { max: 250, ref: '3.12.5' },
    egress: { maxS: 5, ref: '—' },
    unverified: [
      'Edition is 2023 — no 2026 FSC rulebook found',
      'Upright/reclined 30° threshold not confirmed from the text',
      'Egress time limit not confirmed from the text',
      'Head-restraint gap per driver not confirmed from the text',
    ],
  },
};

export const RULE_IDS: RuleId[] = ['fsae', 'fsuk', 'fsj', 'fsc'];
