// ─────────────────────────────────────────────────────────────
//  database.js — Bodyweight Roulette Exercise Catalog (Restructured)
// ─────────────────────────────────────────────────────────────

export const DIFFICULTIES = {
  BEGINNER: 'beginner',
  INTERMEDIATE: 'intermediate',
  ADVANCED: 'advanced',
  ELITE: 'elite', // Master
};

export const CATEGORIES = {
  UPPER_PUSH: 'upper_push',
  UPPER_PULL: 'upper_pull',
  LOWER: 'lower',
  CORE: 'core', // Core & Conditioners
};

// ─── Helper function ──────────────────────────────────────────
export function getRandomExercise(difficulty = 'all', category = 'all', lastExerciseId = null) {
  let list = EXERCISES;
  if (difficulty !== 'all') {
    list = list.filter(e => e.difficulty === difficulty);
  }
  if (category !== 'all') {
    list = list.filter(e => e.category === category);
  }
  // Avoid repeating last exercise if possible
  if (lastExerciseId && list.length > 1) {
    list = list.filter(e => e.id !== lastExerciseId);
  }
  if (list.length === 0) return EXERCISES[Math.floor(Math.random() * EXERCISES.length)];
  return list[Math.floor(Math.random() * list.length)];
}

// ─── Exercise Catalog ────────────────────────────────────────
// 65 exercises  ·  4 categories  ·  4 difficulty tiers
// unit: 'reps' | 'seconds'
// ─────────────────────────────────────────────────────────────

export const EXERCISES = [
  // ===========================================================
  //  1. UPPER BODY PUSHING
  // ===========================================================
  {
    id: 'incline_pushup',
    name: 'Incline Push-Up',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Place hands on a raised surface and push your body up, keeping core aligned.',
    muscleEmphasis: 'Lower Chest, Shoulders, Triceps',
    icon: '📐',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Incline-Push-Up.gif'
  },
  {
    id: 'knee_diamond_pushup',
    name: 'Knee Diamond Push-Up',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Perform push-ups on knees with index fingers and thumbs touching in a diamond shape.',
    muscleEmphasis: 'Triceps, Inner Chest',
    icon: '🦵',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Knee-Push-Up.gif'
  },
  {
    id: 'knee_hand_release_pushup',
    name: 'Knee Hand-Release Push-Up',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Lower yourself to the floor on your knees, lift hands off ground, then push back up.',
    muscleEmphasis: 'Chest, Triceps, Upper Back',
    icon: '🖐️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/01/Kneeling-Push-up.gif'
  },
  {
    id: 'pike_hold',
    name: 'Pike Hold',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Hold a pike position with hips raised high and hands on the floor to build shoulder strength.',
    muscleEmphasis: 'Shoulders, Core, Upper Back',
    icon: '📐',
    unit: 'seconds',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Pike-Push-up.gif'
  },
  {
    id: 'standard_military_pushup',
    name: 'Standard Push-Up',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Classic push-up with elbows tucked at 45 degrees. Keep core tight and body straight.',
    muscleEmphasis: 'Chest, Shoulders, Triceps',
    icon: '💪',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Push-Up.gif'
  },
  {
    id: 'diamond_close_grip_pushup',
    name: 'Diamond / Close-Grip Push-Up',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Push-up with hands placed close together to emphasize the triceps and inner chest.',
    muscleEmphasis: 'Triceps, Chest',
    icon: '💎',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Diamond-Push-up.gif'
  },
  {
    id: 'pike_pushup',
    name: 'Pike Push-Up',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.UPPER_PUSH,
    description: 'In a pike position, lower your head toward the floor between your hands and push up.',
    muscleEmphasis: 'Shoulders, Triceps, Core',
    icon: '🔺',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Pike-Push-up.gif'
  },
  {
    id: 'wide_grip_pushup',
    name: 'Wide-Grip Push-Up',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Push-up with hands wider than shoulder-width to place greater emphasis on the chest.',
    muscleEmphasis: 'Chest, Shoulders',
    icon: '↔️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Push-Up.gif'
  },
  {
    id: 'decline_pushup',
    name: 'Decline Push-Up',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.UPPER_PUSH,
    description: 'With feet elevated on a bench or step, push up to target upper chest and shoulder stabilizers.',
    muscleEmphasis: 'Upper Chest, Shoulders, Triceps',
    icon: '📉',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2015/07/Decline-Push-Up.gif'
  },
  {
    id: 'parallel_bar_dips',
    name: 'Bulgarian / Parallel Bar Dips',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Lower and raise your body on parallel bars, bending elbows to 90 degrees.',
    muscleEmphasis: 'Chest, Triceps, Shoulders',
    icon: '⏸️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/04/parallel-bar-dip.gif'
  },
  {
    id: 'handstand_hold',
    name: 'Handstand Hold',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Hold a handstand against a wall to build overhead pressing stability and shoulder endurance.',
    muscleEmphasis: 'Shoulders, Core, Upper Back',
    icon: '🤸',
    unit: 'seconds',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/handstand-holds.gif'
  },
  {
    id: 'hand_release_pushup',
    name: 'Hand-Release Push-Up',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Lower body flat to floor, extend arms out into a T-shape, place hands back and push up.',
    muscleEmphasis: 'Chest, Triceps, Upper Back',
    icon: '✋',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Push-Up.gif'
  },
  {
    id: 'dive_bomber_pushup',
    name: 'Dive Bomber Push-Up',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Start in pike, swoop head low to floor and arch chest up into cobra, then reverse the swoop.',
    muscleEmphasis: 'Chest, Shoulders, Triceps, Lower Back',
    icon: '💣',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pike-to-Cobra.gif'
  },
  {
    id: 'one_arm_pushup',
    name: 'One-Arm Push-Up',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.UPPER_PUSH,
    description: 'Perform a push-up with one hand placed under chest and feet wide to maintain balance.',
    muscleEmphasis: 'Chest, Triceps, Core',
    icon: '🥇',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/09/Single-Arm-Push-up.gif'
  },
  {
    id: 'handstand_pushup',
    name: 'Handstand Push-Up',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.UPPER_PUSH,
    description: 'From a wall-supported handstand, lower head to touch the floor, then press back up.',
    muscleEmphasis: 'Shoulders, Triceps, Core',
    icon: '🤸‍♀️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/handstand-push-up.gif'
  },

  // ===========================================================
  //  2. UPPER BODY PULLING
  // ===========================================================
  {
    id: 'incline_inverted_row',
    name: 'Incline Inverted Row',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.UPPER_PULL,
    description: 'Hang under a high bar or table and pull chest up, maintaining an incline angle with feet on floor.',
    muscleEmphasis: 'Upper Back, Lats, Biceps',
    icon: '📐',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Inverted-Row.gif'
  },
  {
    id: 'doorframe_pulls',
    name: 'Doorframe Pulls',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.UPPER_PULL,
    description: 'Stand in a doorway, hold the doorframe, and lean back, pulling your chest to the frame.',
    muscleEmphasis: 'Lats, Upper Back, Biceps',
    icon: '🚪',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2023/06/Bodyweight-Row-in-Doorway.gif'
  },
  {
    id: 'scapular_pullup',
    name: 'Scapular Pull-Up',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.UPPER_PULL,
    description: 'Hang from a bar and pull your body up slightly by depressing and retracting your shoulder blades.',
    muscleEmphasis: 'Lower Traps, Scapular Stabilizers',
    icon: '🦅',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/01/Scapula-Pull-up.gif'
  },
  {
    id: 'flat_inverted_row',
    name: 'Flat Inverted Row',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.UPPER_PULL,
    description: 'Position bar low to allow horizontal body alignment. Pull chest up to the bar.',
    muscleEmphasis: 'Mid-Back, Lats, Rear Delts, Biceps',
    icon: '➖',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/04/Table-Inverted-Row.gif'
  },
  {
    id: 'inverted_row_underhand',
    name: 'Inverted Row (Underhand)',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.UPPER_PULL,
    description: 'Perform an inverted row with an underhand grip to increase bicep activation.',
    muscleEmphasis: 'Biceps, Lats, Mid-Back',
    icon: '🔄',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/01/Ring-Inverted-Row.gif'
  },
  {
    id: 'chin_up',
    name: 'Chin-Up',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.UPPER_PULL,
    description: 'Pull body up on a bar using an underhand (supinated) grip until chin clears the bar.',
    muscleEmphasis: 'Biceps, Lats, Upper Back',
    icon: '🆙',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/03/Chin-Up.gif'
  },
  {
    id: 'dead_hang_pullup',
    name: 'Dead-Hang Pull-Up',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.UPPER_PULL,
    description: 'From a dead hang with overhand grip, pull up smoothly without kicking until chin clears the bar.',
    muscleEmphasis: 'Lats, Upper Back, Rear Delts, Forearms',
    icon: '💀',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pull-up.gif'
  },
  {
    id: 'mixed_grip_pullup',
    name: 'Mixed-Grip Pull-Up',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.UPPER_PULL,
    description: 'Pull up with one hand overhand and one hand underhand. Swap sides per set.',
    muscleEmphasis: 'Lats, Biceps, Forearms',
    icon: '🔀',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/04/Reverse-grip-Pull-up.gif'
  },
  {
    id: 'commando_pullup',
    name: 'Commando Pull-Up',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.UPPER_PULL,
    description: 'Stand sideways under a bar, hold with close staggered grip, and pull up alternating sides.',
    muscleEmphasis: 'Obliques, Biceps, Lats, Core',
    icon: '🪖',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/01/commander-pull-up.gif'
  },
  {
    id: 'typewriter_pullup',
    name: 'Typewriter Pull-Up',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.UPPER_PULL,
    description: 'Pull chest up to bar, slide body horizontally to one hand, then to the other, before lowering.',
    muscleEmphasis: 'Lats, Upper Back, Rear Delts, Core',
    icon: '⌨️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/01/Archer-Pull-up.gif'
  },
  {
    id: 'leg_tuck',
    name: 'Leg Tuck',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.UPPER_PULL,
    description: 'Hanging from a bar with alternating grip, flex elbows and hips to pull knees to touch elbows.',
    muscleEmphasis: 'Abs, Hip Flexors, Grip, Lats',
    icon: '🦵',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Hanging-Knee-Raises.gif'
  },
  {
    id: 'archer_pullup',
    name: 'Archer Pull-Up',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.UPPER_PULL,
    description: 'Pull up while keeping one arm completely straight, sliding chest to the bent-arm hand.',
    muscleEmphasis: 'Lats, Rear Delts, Biceps, Shoulders',
    icon: '🏹',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/01/Archer-Pull-up.gif'
  },
  {
    id: 'muscle_up',
    name: 'The Muscle-Up',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.UPPER_PULL,
    description: 'Combine a fast explosive pull-up with a transition over the bar into a straight bar dip.',
    muscleEmphasis: 'Lats, Chest, Shoulders, Triceps, Core',
    icon: '🚀',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Muscle-up-vertical-bar.gif'
  },
  {
    id: 'one_arm_chinup',
    name: 'One-Arm Chin-Up',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.UPPER_PULL,
    description: 'Hanging from a bar with one arm, pull your body up until your chin clears the bar.',
    muscleEmphasis: 'Biceps, Lats, Forearms, Core',
    icon: '🥇',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/01/One-Arm-Chin-Up.gif'
  },

  // ===========================================================
  //  3. LOWER BODY
  // ===========================================================
  {
    id: 'bench_squat',
    name: 'Bench Squat',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.LOWER,
    description: 'Squat down until thighs touch a bench behind you, then stand up.',
    muscleEmphasis: 'Quads, Glutes, Hamstrings',
    icon: '🪑',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/07/Bodyweight-Box-Squat.gif'
  },
  {
    id: 'glute_bridge',
    name: 'Glute Bridge',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.LOWER,
    description: 'Lie on your back, bend knees, and lift hips toward the ceiling, squeezing glutes.',
    muscleEmphasis: 'Glutes, Hamstrings, Core',
    icon: '🌉',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Glute-Bridge-.gif'
  },
  {
    id: 'lateral_side_steps',
    name: 'Lateral Side-Steps',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.LOWER,
    description: 'Stay in a partial squat and take side steps to activate hip abductors.',
    muscleEmphasis: 'Glute Medius, Quads',
    icon: '👣',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Lateral-Speed-Step.gif'
  },
  {
    id: 'two_leg_calf_raise',
    name: 'Two-Leg Calf Raise',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.LOWER,
    description: 'Raise heels off the floor, balancing on your toes, then lower with control.',
    muscleEmphasis: 'Calves (Gastrocnemius, Soleus)',
    icon: '🦵',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Standing-Calf-Raise.gif'
  },
  {
    id: 'full_air_squat',
    name: 'Full Air Squat / Health Squat',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.LOWER,
    description: 'Squat down below parallel while keeping chest up and heels flat on the floor.',
    muscleEmphasis: 'Quads, Glutes, Hamstrings, Calves',
    icon: '💨',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Bodyweight-Squat.gif'
  },
  {
    id: 'single_leg_glute_bridge',
    name: 'Single-Leg Glute Bridge',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.LOWER,
    description: 'Perform a glute bridge with one leg extended straight out in the air.',
    muscleEmphasis: 'Glutes, Hamstrings, Lower Back',
    icon: '🌉',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Glute-Bridge-.gif'
  },
  {
    id: 'alternating_reverse_lunges',
    name: 'Alternating Reverse Lunges',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.LOWER,
    description: 'Step backward into a lunge position, lowering back knee close to the floor. Alternate legs.',
    muscleEmphasis: 'Quads, Glutes, Hamstrings',
    icon: '🔄',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/08/bodyweight-reverse-lunge.gif'
  },
  {
    id: 'single_leg_calf_raise',
    name: 'Single-Leg Calf Raise',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.LOWER,
    description: 'Balance on one leg and lift your heel, raising bodyweight entirely on one calf.',
    muscleEmphasis: 'Calves',
    icon: '🦵',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Single-Leg-Calf-Raises.gif'
  },
  {
    id: 'squat_pulse',
    name: 'Squat Pulse',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.LOWER,
    description: 'Lower to the bottom of your squat and perform short, pulsing movements to sustain tension.',
    muscleEmphasis: 'Quads, Glutes, Endurance',
    icon: '⚡',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Bodyweight-Squat.gif'
  },
  {
    id: 'bulgarian_split_squat',
    name: 'Bulgarian Split Squat',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.LOWER,
    description: 'With one foot elevated on a bench behind you, squat down on the forward leg.',
    muscleEmphasis: 'Quads, Glutes, Hip Stabilizers',
    icon: '🇧🇬',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/02/Bodyweight-Bulgarian-Split-Squat.gif'
  },
  {
    id: 'sliding_hamstring_curl',
    name: 'Sliding Hamstring Curl',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.LOWER,
    description: 'In a glute bridge hold, slide heels away from hips, then pull them back using hamstrings.',
    muscleEmphasis: 'Hamstrings, Glutes, Lower Back',
    icon: '⛸️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/02/Towel-Leg-Curl.gif'
  },
  {
    id: 'walking_lunges',
    name: 'Walking Lunges',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.LOWER,
    description: 'Lunge forward alternating legs, walking forward continuously.',
    muscleEmphasis: 'Quads, Glutes, Hamstrings, Balance',
    icon: '🚶',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2023/09/bodyweight-walking-lunge.gif'
  },
  {
    id: 'deficit_single_leg_raise',
    name: 'Deficit Single-Leg Raise',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.LOWER,
    description: 'Stand on a step edge, lower heel below step level (deficit), then raise up onto toes.',
    muscleEmphasis: 'Calves, Ankle Mobility',
    icon: '🪜',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Single-Leg-Calf-Raises.gif'
  },
  {
    id: 'jump_squat_jump_lunge',
    name: 'Jump Squat / Jump Lunge',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.LOWER,
    description: 'Explosive plyometric jumping squats or lunges to build lower-body power.',
    muscleEmphasis: 'Quads, Glutes, Calves, Cardiovascular',
    icon: '🦘',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Jump-Squat.gif'
  },
  {
    id: 'pistol_squat',
    name: 'Pistol Squat',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.LOWER,
    description: 'Perform a single-leg squat, extending the non-working leg straight out in front.',
    muscleEmphasis: 'Quads, Glutes, Core, Balance, Mobility',
    icon: '🔫',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Pistol-Squat.gif'
  },
  {
    id: 'airborne_lunge',
    name: 'Airborne Lunge',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.LOWER,
    description: 'Single-leg squat where you lower back knee to touch floor, keeping foot off ground.',
    muscleEmphasis: 'Quads, Glutes, Ankle Stability',
    icon: '🛩️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/shrimp-squats.gif'
  },
  {
    id: 'nordic_hamstring_curl',
    name: 'Nordic Hamstring Curl',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.LOWER,
    description: 'Kneeling with ankles locked, lower torso to floor under control using hamstrings.',
    muscleEmphasis: 'Hamstrings, Knees',
    icon: '❄️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/06/Nordic-Hamstring-Curl.gif'
  },
  {
    id: 'high_jumpers',
    name: 'High Jumpers',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.LOWER,
    description: 'Explosive vertical jumps from a deep squat, pulling knees up to chest mid-air.',
    muscleEmphasis: 'Quads, Calves, Explosiveness',
    icon: '🤸',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/09/Tuck-Jump.gif'
  },

  // ===========================================================
  //  4. CORE, TRUNK & FULL-BODY CONDITIONERS
  // ===========================================================
  {
    id: 'standard_crunch',
    name: 'Standard Crunch',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.CORE,
    description: 'Lie on back with knees bent, curl shoulders up slightly off the floor using abs.',
    muscleEmphasis: 'Upper Abs',
    icon: '🥣',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2015/11/Crunch.gif'
  },
  {
    id: 'bird_dog',
    name: 'Bird-Dog',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.CORE,
    description: 'On hands and knees, extend opposite arm and leg straight out. Alternate sides.',
    muscleEmphasis: 'Lower Back, Glutes, Core Stabilizers',
    icon: '🐕',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/07/Bird-Dog.gif'
  },
  {
    id: 'forearm_plank',
    name: 'Forearm Plank',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.CORE,
    description: 'Hold a push-up position resting on your forearms. Keep body straight and core squeezed.',
    muscleEmphasis: 'Transverse Abdominis, Shoulders, Core',
    icon: '🪵',
    unit: 'seconds',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/plank.gif'
  },
  {
    id: 'superman_hold',
    name: 'Superman Hold',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.CORE,
    description: 'Lie face down and lift arms, chest, and legs off the floor, holding the position.',
    muscleEmphasis: 'Lower Back, Glutes, Upper Back',
    icon: '🦸',
    unit: 'seconds',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Superman-exercise.gif'
  },
  {
    id: 'jumping_jacks',
    name: 'Side-Straddle Hop (Jacks)',
    difficulty: DIFFICULTIES.BEGINNER,
    category: CATEGORIES.CORE,
    description: 'Perform jumping jacks, jumping feet wide while raising hands, then returning.',
    muscleEmphasis: 'Cardio, Full Body',
    icon: '🏃',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Jumping-jack.gif'
  },
  {
    id: 'dead_bug',
    name: 'Dead Bug (PRT Standard)',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.CORE,
    description: 'Lie face up, lower opposite arm and leg slowly toward floor. Alternate.',
    muscleEmphasis: 'Deep Core, Coordination',
    icon: '🪲',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Dead-Bug.gif'
  },
  {
    id: 'bicycle_crunch',
    name: 'Bicycle Crunch',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.CORE,
    description: 'Lying face up, alternate touching elbow to opposite knee with twisting crunch motion.',
    muscleEmphasis: 'Obliques, Upper/Lower Abs',
    icon: '🚲',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Bicycle-Crunch.gif'
  },
  {
    id: 'side_plank',
    name: 'Side Plank',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.CORE,
    description: 'Balance on one forearm and foot sideways, lifting hips to form a straight line.',
    muscleEmphasis: 'Obliques, Shoulder Stability',
    icon: '➖',
    unit: 'seconds',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/05/Side-Bridge.gif'
  },
  {
    id: 'alternating_superman',
    name: 'Alternating Superman',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.CORE,
    description: 'Lie face down, alternate lifting opposite arm and opposite leg.',
    muscleEmphasis: 'Lower Back, Glutes',
    icon: '🦸‍♀️',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Superman-exercise.gif'
  },
  {
    id: 'mountain_climbers',
    name: 'Mountain Climbers',
    difficulty: DIFFICULTIES.INTERMEDIATE,
    category: CATEGORIES.CORE,
    description: 'From high plank, alternate driving knees rapidly toward chest.',
    muscleEmphasis: 'Abs, Shoulders, Cardio',
    icon: '🧗',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Mountain-climber.gif'
  },
  {
    id: 'v_up',
    name: 'V-Up / Leg-Casey',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.CORE,
    description: 'Lying flat, fold torso and straight legs upward to meet hands in a V-shape.',
    muscleEmphasis: 'Abdominals, Hip Flexors',
    icon: '∨',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Jackknife-Sit-ups.gif'
  },
  {
    id: 'russian_twist',
    name: 'Russian Twist',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.CORE,
    description: 'Sit with knees bent, feet slightly off floor, and rotate torso to tap hands on either side.',
    muscleEmphasis: 'Obliques, Hip Flexors',
    icon: '🇷🇺',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Russian-Twist.gif'
  },
  {
    id: 'rkc_plank',
    name: 'RKC Plank',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.CORE,
    description: 'Forearm plank pulling elbows and toes dynamically toward center, bracing whole body.',
    muscleEmphasis: 'Abs, Glutes, Deep Tension',
    icon: '🪵',
    unit: 'seconds',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/plank.gif'
  },
  {
    id: 'flutter_kicks',
    name: 'Flutter Kicks / Hello Darlings',
    difficulty: DIFFICULTIES.ADVANCED,
    category: CATEGORIES.CORE,
    description: 'Lying flat, lift heels off floor and perform rapid alternating vertical scissor kicks.',
    muscleEmphasis: 'Lower Abs, Hip Flexors',
    icon: '🏊',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2021/02/Flutter-Kicks.gif'
  },
  {
    id: 'hanging_leg_raise_windshield_wipers',
    name: 'Hanging Leg Raise / Wipers',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.CORE,
    description: 'Hanging from bar, raise legs and rotate them side to side in an arc (or do straight raises).',
    muscleEmphasis: 'Obliques, Abs, Grip',
    icon: '🚗',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/01/Hanging-Windshield-Wiper.gif'
  },
  {
    id: 'dragon_flag',
    name: 'Dragon Flag',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.CORE,
    description: 'Grip bench behind head, lift entire body in a straight line, lowering and raising using abs.',
    muscleEmphasis: 'Core, Upper Back, Triceps',
    icon: '🐉',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2022/07/Leg-Raise-Dragon-Flag.gif'
  },
  {
    id: 'front_lever',
    name: 'Front Lever',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.CORE,
    description: 'Hanging from bar, pull down with straight arms to hold your body horizontal face up.',
    muscleEmphasis: 'Lats, Core, Shoulders, Grip',
    icon: '🕹️',
    unit: 'seconds',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2023/06/Front-Lever-Pull-up.gif'
  },
  {
    id: 'eight_count_bodybuilder',
    name: 'The 8-Count Body Builder',
    difficulty: DIFFICULTIES.ELITE,
    category: CATEGORIES.CORE,
    description: 'High-intensity conditioner: squat, kick feet out, push-up, plank jack, push-up, hop in, stand.',
    muscleEmphasis: 'Full Body, Cardiovascular',
    icon: '👷',
    unit: 'reps',
    illustration: 'https://fitnessprogramer.com/wp-content/uploads/2023/10/Navy-Seal-Burpee.gif'
  }
];
