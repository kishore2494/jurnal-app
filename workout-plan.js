/* Kishore's real Fitness Zone workout plan.
   Adapted from the "Gym How-To" app. Each exercise has a stable id, sets/duration,
   an `anim` key (rendered by workout-anims.js → renderAnim), and a form tip.
   Edit freely — the Gym tab and Sheet sync pick up changes automatically. */

const WORKOUT_PLAN = [
  { id: 'cardio', name: 'Cardio', emoji: '🏃', color: '#ef4444', exercises: [
    { name: 'Warm Up',       sets: '10 min',   anim: 'jog' },
    { name: 'Treadmill',     sets: '10 min',   anim: 'jog' },
    { name: 'Cross Trainer', sets: '10 min',   anim: 'cross' },
    { name: 'Spin Bike',     sets: '10 min',   anim: 'bike' },
    { name: 'Warm Down',     sets: '5 min',    anim: 'stretch' },
    { name: 'Jumping Jacks', sets: '3 × 25',   anim: 'jack' },
    { name: 'High Knees',    sets: '3 × 25',   anim: 'knees' },
    { name: 'Step Ups',      sets: '3 × 25',   anim: 'step' },
    { name: 'Run in Place',  sets: '3 × 25',   anim: 'jog' },
    { name: 'Sprint',        sets: '3 × 25',   anim: 'sprint' },
    { name: 'Skipping',      sets: '3 × 50',   anim: 'skip' },
  ]},
  { id: 'abs', name: 'Abs', emoji: '🔥', color: '#f59e0b', exercises: [
    { name: 'Crunches',  sets: '3 × 15', anim: 'crunch',   tip: 'Lift shoulders, not neck. Exhale up.' },
    { name: 'Leg Raise', sets: '3 × 15', anim: 'legraise', tip: 'Lower back stays glued to floor.' },
  ]},
  { id: 'side', name: 'Sides', emoji: '🌀', color: '#f59e0b', exercises: [
    { name: 'DB Side Bend', sets: '3 × 30', anim: 'sidebend', tip: 'One dumbbell, bend sideways only.' },
  ]},
  { id: 'core', name: 'Core', emoji: '🪨', color: '#f59e0b', exercises: [
    { name: 'Planks',      sets: '3 × 30 sec', anim: 'plank',     tip: "Squeeze glutes, don't sag hips." },
    { name: 'Side Planks', sets: '3 × 30 sec', anim: 'sideplank', tip: 'Straight line from head to feet.' },
  ]},
  { id: 'chest', name: 'Chest', emoji: '💪', color: '#3b82f6', exercises: [
    { name: 'Push Up',                     sets: '3 × 15', anim: 'pushup',   tip: 'Body straight, elbows ~45°.' },
    { name: 'Machine Chest Press',         sets: '3 × 15', anim: 'press',    tip: "Don't lock elbows. Controlled tempo." },
    { name: 'Machine Incline Chest Press', sets: '3 × 15', anim: 'incline',  tip: 'Targets upper chest.' },
    { name: 'Machine Pec Fly',             sets: '3 × 15', anim: 'fly',      tip: 'Slight elbow bend. Squeeze at center.' },
    { name: 'DB Pullover',                 sets: '3 × 15', anim: 'pullover', tip: 'Lie flat. Arc the weight overhead.' },
  ]},
  { id: 'triceps', name: 'Triceps & Wrist', emoji: '🦾', color: '#8b5cf6', exercises: [
    { name: 'Cable Push Down',   sets: '3 × 15', anim: 'pushdown', tip: 'Elbows pinned to sides.' },
    { name: 'DB Extension',      sets: '3 × 15', anim: 'ext',      tip: 'Overhead. Keep elbows tight.' },
    { name: 'Skull Crunches',    sets: '3 × 15', anim: 'skull',    tip: 'Lower bar to forehead, not nose.' },
    { name: 'Seated Tricep Dips',sets: '3 × 15', anim: 'dip',      tip: 'Elbows back, not flared out.' },
  ]},
  { id: 'shoulder', name: 'Shoulder', emoji: '🏔️', color: '#10b981', exercises: [
    { name: 'DB Shoulder Press', sets: '3 × 15', anim: 'shpress',  tip: 'Press straight up, ribs down.' },
    { name: 'DB Lateral Raise',  sets: '3 × 15', anim: 'lateral',  tip: 'Lead with elbows. Stop at shoulder height.' },
    { name: 'Machine Rear Fly',  sets: '3 × 15', anim: 'rearfly',  tip: 'Squeeze rear delts at end range.' },
    { name: 'DB Shrug',          sets: '3 × 15', anim: 'shrug',    tip: 'Straight up. No rolling.' },
  ]},
  { id: 'biceps', name: 'Biceps', emoji: '💪', color: '#ec4899', exercises: [
    { name: 'Cable Biceps Curl',     sets: '3 × 15', anim: 'curl',    tip: 'Elbows pinned. Full range.' },
    { name: 'DB Alternate Curl',     sets: '3 × 15', anim: 'altcurl', tip: 'One arm at a time. No swing.' },
    { name: 'DB Hammer Curl',        sets: '3 × 15', anim: 'hammer',  tip: 'Neutral grip. Targets brachialis.' },
    { name: 'DB Concentration Curl', sets: '3 × 15', anim: 'concurl', tip: 'Elbow against inner thigh.' },
  ]},
  { id: 'back', name: 'Back & Lat', emoji: '🦅', color: '#06b6d4', exercises: [
    { name: 'Machine Lat Pull Down',  sets: '3 × 15', anim: 'latpull',  tip: 'Pull to upper chest. Lead with elbows.' },
    { name: 'Machine Back Pull Down', sets: '3 × 15', anim: 'backpull', tip: 'Squeeze shoulder blades.' },
    { name: 'Machine Seated Rows',    sets: '3 × 15', anim: 'row',      tip: 'Chest up. Pull to belly button.' },
    { name: 'DB Rows',                sets: '3 × 15', anim: 'dbrow',    tip: 'Flat back. Pull elbow back, not up.' },
  ]},
  { id: 'legs', name: 'Legs & Calf', emoji: '🦵', color: '#f97316', exercises: [
    { name: 'Free Squats',   sets: '3 × 15', anim: 'squat',    tip: 'Knees track over toes. Chest up.' },
    { name: 'Leg Press',     sets: '3 × 15', anim: 'legpress', tip: "Don't lock knees at top." },
    { name: 'Leg Extension', sets: '3 × 15', anim: 'legext',   tip: 'Squeeze quads at top.' },
    { name: 'Leg Curl',      sets: '3 × 15', anim: 'legcurl',  tip: 'Slow eccentric. Feel hamstrings.' },
    { name: 'Calf Raise',    sets: '3 × 15', anim: 'calf',     tip: 'Full stretch bottom, full squeeze top.' },
  ]},
];

// Assign a stable id to each exercise + build a flat lookup by id.
const WORKOUT_BY_ID = {};
WORKOUT_PLAN.forEach(g => g.exercises.forEach((ex, i) => {
  ex.id = g.id + '-' + i;
  ex.group = g.id;
  WORKOUT_BY_ID[ex.id] = ex;
}));

/* ---------------------------------------------------------------
   6-DAY SPLIT (from the Fitness Zone card).
   Each day = mandatory Cardio + that day's muscle workout + the rotating
   Abs/Sides/Core group:  Day1 Abs · Day2 Sides · Day3 Core · Day4 Abs ·
   Day5 Sides · Day6 Core.
     main : muscle group id  (chest | triceps | shoulder | biceps | back | legs)
     ab   : 'abs' | 'side' | 'core'
   --------------------------------------------------------------- */
const WORKOUT_DAYS = [
  { id: 'day1', name: 'Day 1', main: 'chest',    ab: 'abs'  },
  { id: 'day2', name: 'Day 2', main: 'triceps',  ab: 'side' },
  { id: 'day3', name: 'Day 3', main: 'shoulder', ab: 'core' },
  { id: 'day4', name: 'Day 4', main: 'biceps',   ab: 'abs'  },
  { id: 'day5', name: 'Day 5', main: 'back',     ab: 'side' },
  { id: 'day6', name: 'Day 6', main: 'legs',     ab: 'core' },
];
const groupById = id => WORKOUT_PLAN.find(g => g.id === id) || WORKOUT_PLAN[0];
const CARDIO_GROUP = groupById('cardio');
// A day's main muscle group (used for the card label/color).
function dayMain(day) { return groupById(day.main); }
// Compose a day's blocks: Cardio (always) + muscle group + the rotating ab group.
function dayBlocks(day) {
  const main = groupById(day.main);
  const ab = groupById(day.ab);
  return [
    { title: '🏃 Cardio',                  color: CARDIO_GROUP.color, exercises: CARDIO_GROUP.exercises },
    { title: main.emoji + ' ' + main.name, color: main.color,        exercises: main.exercises },
    { title: ab.emoji + ' ' + ab.name,     color: ab.color,          exercises: ab.exercises },
  ];
}
function dayExercises(day) { return dayBlocks(day).reduce((a, b) => a.concat(b.exercises), []); }
