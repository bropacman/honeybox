// All the words in Honeybox. Edit freely: add questions, prompts and polls here.

export const PILE_NAMES = [
  'Santa\'s Village', 'Mt Washington', 'Flume Gorge',
  'Clark\'s Bears', 'The Kanc', 'Story Land',
  'Funspot', 'Weirs Beach', 'Lake Dock',
  'Loudon Speedway'
];

// Little sign icon for each spot on the map
export const PILE_ICONS = {
  'Santa\'s Village': '🎅', 'Mt Washington': '🏔️', 'Flume Gorge': '🏞️',
  'Clark\'s Bears': '🐻', 'The Kanc': '🛣️', 'Story Land': '🏰',
  'Funspot': '🕹️', 'Weirs Beach': '🏖️', 'Lake Dock': '🏚️',
  'Loudon Speedway': '🏁'
};

// After closing time, the Story Land animatronics wake up...
export const DANGERS = [
  { name: 'Humpty Dumpty, cracked and grinning', emoji: '🥚' },
  { name: 'the Pumpkin Coach (no horses, still moving)', emoji: '🎃' },
  { name: 'Cinderella, missing a slipper and VERY upset about it', emoji: '👸' },
  { name: 'a swan boat that paddles itself across Winnipesaukee', emoji: '🦢' },
  { name: 'the Roar-O-Saurus, eyes glowing red', emoji: '🦖' },
  { name: 'the Old Woman who lives in a Shoe (and all her kids)', emoji: '👢' },
  { name: 'an animatronic bear that will not stop singing', emoji: '🐻' },
  { name: 'a moose standing in the middle of Route 16', emoji: '🫎' },
  { name: 'the thing that lives under the Lake Dock', emoji: '🐙' },
  { name: 'a carousel horse that got loose', emoji: '🐴' },
  { name: 'the Winnipesaukee lake monster', emoji: '🐍' },
  { name: 'a clown who missed the last tram', emoji: '🤡' },
  { name: 'a possessed Skee-Ball machine from Funspot', emoji: '🕹️' },
  { name: 'an animatronic elf from Santa\'s Village, off-season and angry', emoji: '🧝' },
  { name: 'the Cog Railway train, running with no conductor', emoji: '🚂' },
  { name: 'a 231 mph gust off Mount Washington', emoji: '🌪️' },
  { name: 'one of Clark\'s bears, done performing for the night', emoji: '🐻' },
  { name: 'whatever lives at the bottom of the Flume', emoji: '👁️' }
];

// Players stay cute.
export const AVATARS = [
  '🐶', '🐕', '🦮', '🐩', '🐱', '🐰', '🐻', '🐼', '🐨', '🦊', '🦝', '🐷',
  '🐸', '🐵', '🦉', '🐧', '🦆', '🐢', '🦄', '🐝', '🦌', '🫎', '🐿️', '🦔'
];

// a = index of the correct choice
export const TRIVIA = [
  { q: "What is New Hampshire's state motto?", c: ['Live Free or Die', "Don't Tread on Me", 'Ever Upward', 'The Way Life Should Be'], a: 0 },
  { q: "What is New Hampshire's nickname?", c: ['The Pine Tree State', 'The Granite State', 'The Green Mountain State', 'The Ocean State'], a: 1 },
  { q: 'What is the highest peak in New Hampshire (and the Northeast US)?', c: ['Mount Monadnock', 'Mount Lafayette', 'Mount Washington', 'Mount Katahdin'], a: 2 },
  { q: 'In 1934, Mount Washington recorded a wind gust of about how fast?', c: ['91 mph', '150 mph', '231 mph', '310 mph'], a: 2 },
  { q: 'What is the capital of New Hampshire?', c: ['Manchester', 'Concord', 'Portsmouth', 'Nashua'], a: 1 },
  { q: 'What is the largest lake entirely within New Hampshire?', c: ['Squam Lake', 'Lake Sunapee', 'Lake Winnipesaukee', 'Newfound Lake'], a: 2 },
  { q: 'What famous NH rock formation collapsed in 2003?', c: ['The Old Man of the Mountain', 'The Profile Arch', 'Indian Head', 'The Granite Giant'], a: 0 },
  { q: 'Which state traditionally holds the first presidential primary?', c: ['Iowa', 'New Hampshire', 'South Carolina', 'Vermont'], a: 1 },
  { q: 'Roughly how long is the New Hampshire coastline?', c: ['5 miles', '18 miles', '52 miles', '101 miles'], a: 1 },
  { q: "What is New Hampshire's state bird?", c: ['Common Loon', 'Purple Finch', 'Black-capped Chickadee', 'Wild Turkey'], a: 1 },
  { q: 'Betty and Barney Hill claimed they were abducted by aliens in 1961 in which state?', c: ['New Mexico', 'Maine', 'New Hampshire', 'Nevada'], a: 2 },
  { q: 'The Appalachian Trail runs from Georgia to which state?', c: ['New Hampshire', 'Vermont', 'Maine', 'New York'], a: 2 },
  { q: 'At the top of Mount Washington, water boils at a ___ temperature than at sea level.', c: ['Higher', 'Lower', 'Exactly the same', 'Water cannot boil there'], a: 1 },
  { q: 'What is the smallest dog breed?', c: ['Pomeranian', 'Yorkshire Terrier', 'Chihuahua', 'Toy Poodle'], a: 2 },
  { q: 'Dogs sweat mainly through their…', c: ['Tongue', 'Ears', 'Paw pads', 'Noses'], a: 2 },
  { q: 'Which dog breed is famous for its blue-black tongue?', c: ['Chow Chow', 'Shiba Inu', 'Akita', 'Samoyed'], a: 0 },
  { q: 'What breed is Scooby-Doo?', c: ['Bloodhound', 'Great Dane', 'Mastiff', 'Boxer'], a: 1 },
  { q: 'What breed was Lassie?', c: ['Border Collie', 'German Shepherd', 'Rough Collie', 'Golden Retriever'], a: 2 },
  { q: 'What is the fastest dog breed?', c: ['Greyhound', 'Whippet', 'Border Collie', 'Dalmatian'], a: 0 },
  { q: 'What was the name of the dog that became the first animal to orbit Earth?', c: ['Belka', 'Laika', 'Strelka', 'Sputnik'], a: 1 },
  { q: "What breed is Toto in 'The Wizard of Oz'?", c: ['Scottish Terrier', 'Cairn Terrier', 'West Highland Terrier', 'Jack Russell'], a: 1 },
  { q: 'A dog’s normal body temperature is about…', c: ['96.0°F', '98.6°F', '101.5°F', '105.0°F'], a: 2 },
  { q: 'What should you do if a black bear approaches you?', c: ['Play dead immediately', 'Run as fast as you can', 'Climb the nearest tree', 'Make yourself look big and loud, back away slowly'], a: 3 },
  { q: 'The moose is the largest member of which animal family?', c: ['Cattle', 'Deer', 'Antelope', 'Elk-sheep'], a: 1 },
  { q: 'Roughly how many gallons of maple sap does it take to make 1 gallon of syrup?', c: ['5', '10', '40', '200'], a: 2 },
  { q: 'Which tick is the main carrier of Lyme disease in New England?', c: ['Dog tick', 'Lone star tick', 'Deer (blacklegged) tick', 'Moose tick'], a: 2 },
  { q: 'What is another name for the North Star?', c: ['Sirius', 'Polaris', 'Vega', 'Betelgeuse'], a: 1 },
  { q: 'What does a fire need besides fuel and heat?', c: ['Oxygen', 'Nitrogen', 'Wind', 'Darkness'], a: 0 },
  { q: 'Which food has been found still edible in ancient Egyptian tombs?', c: ['Bread', 'Honey', 'Cheese', 'Dates'], a: 1 },
  { q: 'How many eyes does a honeybee have?', c: ['2', '4', '5', '8'], a: 2 },
  { q: 'A group of crows is called a…', c: ['Murder', 'Parliament', 'Gaggle', 'Conspiracy'], a: 0 },
  { q: 'A group of owls is called a…', c: ['Murder', 'Hoot', 'Parliament', 'Council'], a: 2 },
  { q: 'How many hearts does an octopus have?', c: ['1', '2', '3', '8'], a: 2 },
  { q: 'Which US state has the most moose in the lower 48?', c: ['New Hampshire', 'Maine', 'Minnesota', 'Montana'], a: 1 },
  { q: "The name 's'mores' comes from…", c: ["'Some more'", "'Smoked s'mores'", "A Girl Scout named S. Moore", "'Small mores'"], a: 0 },
  { q: 'Which "nut" is actually a legume?', c: ['Almond', 'Cashew', 'Peanut', 'Walnut'], a: 2 },
  { q: 'Who directed the original 1981 film "The Evil Dead"?', c: ['Wes Craven', 'Sam Raimi', 'John Carpenter', 'George Romero'], a: 1 },
  { q: 'In the original 1980 "Friday the 13th," who is the killer?', c: ['Jason Voorhees', 'Pamela Voorhees', 'Freddy Krueger', 'The camp counselor'], a: 1 },
  { q: 'What is the name of the hotel in "The Shining"?', c: ['The Bates Motel', 'The Overlook Hotel', 'The Stanley Inn', 'The Grand Budapest'], a: 1 },
  { q: 'In "A Quiet Place," the creatures hunt by…', c: ['Smell', 'Sight', 'Sound', 'Heat'], a: 2 },
  { q: '"The Blair Witch Project" takes place in the woods of which state?', c: ['Maine', 'Maryland', 'Vermont', 'Pennsylvania'], a: 1 },
  { q: 'Stephen King sets many of his novels in which state?', c: ['New Hampshire', 'Vermont', 'Maine', 'Massachusetts'], a: 2 },
  { q: 'Where does John Carpenter\'s "The Thing" (1982) take place?', c: ['Alaska', 'Antarctica', 'Siberia', 'Greenland'], a: 1 },
  { q: 'What is the name of the killer\'s mask in "Scream"?', c: ['Ghostface', 'The Shape', 'Leatherface', 'Pinhead'], a: 0 },
  { q: 'In "Halloween" (1978), what town does Michael Myers return to?', c: ['Springwood', 'Haddonfield', 'Derry', 'Woodsboro'], a: 1 },
  { q: 'The Mothman legend comes from which state?', c: ['Ohio', 'West Virginia', 'Kentucky', 'Oregon'], a: 1 },
  { q: 'The Jersey Devil supposedly lives in which forest?', c: ['The Pine Barrens', 'The Poconos', 'Sherwood Forest', 'The Catskills'], a: 0 },
  { q: 'What is another name for Bigfoot?', c: ['Chupacabra', 'Sasquatch', 'Mothman', 'Wendigo'], a: 1 },
  { q: 'The Wendigo comes from the folklore of which peoples?', c: ['Norse', 'Algonquian', 'Celtic', 'Aztec'], a: 1 },
  { q: 'What is the fastest land animal?', c: ['Pronghorn', 'Lion', 'Cheetah', 'Greyhound'], a: 2 },
  { q: 'What is the smallest US state by area?', c: ['Delaware', 'Connecticut', 'Rhode Island', 'New Jersey'], a: 2 },
  { q: 'How many cards are in a standard deck (no jokers)?', c: ['48', '52', '54', '56'], a: 1 },
  { q: 'At what temperature (°F) does water freeze?', c: ['0', '32', '40', '-10'], a: 1 },
  { q: 'Which planet has the most known moons?', c: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], a: 1 },
  { q: 'In the book "Hatchet," what is the main character\'s name?', c: ['Brian', 'Sam', 'Billy', 'Jesse'], a: 0 },
  { q: 'Which famous scenic NH road is known for fall foliage?', c: ['The Kancamagus Highway', 'Route 66', 'The Blue Ridge Parkway', 'Going-to-the-Sun Road'], a: 0 },
  { q: "What is New Hampshire's state animal?", c: ['Moose', 'Black Bear', 'White-tailed Deer', 'Red Fox'], a: 2 },
  { q: 'What do you call a baby bear?', c: ['Kit', 'Cub', 'Pup', 'Calf'], a: 1 },
  { q: 'What do you call a baby moose?', c: ['Calf', 'Fawn', 'Cub', 'Joey'], a: 0 },
  { q: 'Story Land, the fairy-tale theme park, is in which NH village?', c: ['Glen', 'Lincoln', 'Jefferson', 'Meredith'], a: 0 },
  { q: 'Which large cruise ship sails on Lake Winnipesaukee?', c: ['The Lady of the Lake', 'The M/S Mount Washington', 'The Granite Queen', 'The Loon Express'], a: 1 },
  { q: 'Weirs Beach is on which lake?', c: ['Squam Lake', 'Lake Sunapee', 'Lake Winnipesaukee', 'Ossipee Lake'], a: 2 },
  { q: 'The Kancamagus Highway connects Conway to which town?', c: ['Lincoln', 'Laconia', 'Littleton', 'Plymouth'], a: 0 },
  { q: 'Cathedral Ledge, a famous climbing cliff, overlooks which New Hampshire village?', c: ['North Conway', 'Franconia', 'Gorham', 'Jackson'], a: 0 },
  { q: 'Santa\'s Village theme park is in which NH town?', c: ['Glen', 'Jefferson', 'Bartlett', 'Lincoln'], a: 1 },
  { q: 'In "Five Nights at Freddy\'s," what time does each night end?', c: ['4 AM', '5 AM', '6 AM', 'Midnight'], a: 2 },
  { q: 'What is the name of the restaurant in "Five Nights at Freddy\'s"?', c: ["Chuck E.'s Arcade", "Freddy Fazbear's Pizza", "Bonnie's Burger Barn", "Foxy's Fun House"], a: 1 },
  { q: 'At what time does Cinderella\'s magic wear off?', c: ['Sunset', '10 PM', 'Midnight', 'Sunrise'], a: 2 },
  { q: 'In the nursery rhyme, where did Humpty Dumpty sit?', c: ['On a log', 'On a wall', 'On a shelf', 'In a shoe'], a: 1 },
  { q: 'What did Cinderella leave behind at the ball?', c: ['A glass slipper', 'A tiara', 'A pumpkin', 'A glove'], a: 0 },
  { q: 'Funspot, near Weirs Beach, has been called the world\'s largest what?', c: ['Arcade', 'Mini golf course', 'Candy store', 'Bowling alley'], a: 0 },
  { q: 'Clark\'s Trading Post in Lincoln is famous for its trained…', c: ['Moose', 'Black bears', 'Raccoons', 'Seals'], a: 1 },
  { q: 'The Mount Washington Cog Railway (1869) was the world\'s first what?', c: ['Electric train', 'Mountain-climbing cog railway', 'Subway', 'Ski lift'], a: 1 },
  { q: 'The Flume Gorge is in which state park?', c: ['Crawford Notch', 'Franconia Notch', 'Pinkham Notch', 'Dixville Notch'], a: 1 },
  { q: 'The "Kanc" is the nickname for which road?', c: ['Route 16', 'Interstate 93', 'The Kancamagus Highway', 'Route 302'], a: 2 },
  { q: 'Which is the tallest mountain in the Presidential Range?', c: ['Mount Adams', 'Mount Jefferson', 'Mount Washington', 'Mount Madison'], a: 2 },
  { q: 'Which of these is the classic warning about poison ivy?', c: ['Red and yellow, kill a fellow', 'Leaves of three, let it be', 'Shiny and green, stay unseen', 'Hairy vine, no friend of mine'], a: 1 }
];

export const DRAW_PROMPTS = [
  'A bear doing yoga', 'A moose in a hot tub', 'Dad losing a fight to a mosquito', 'The outhouse at midnight',
  'Archie stealing a hot dog', 'Honey guarding the honey', "Bigfoot's dating profile picture", 'A raccoon with a credit card',
  'A lost hiker asking a tree for directions', 'Grandma vs. the black flies', 'A haunted canoe', "S'mores gone horribly wrong",
  'Searching the woods for wifi', 'A loon with a microphone', 'Juggling chainsaws', 'Mom when someone tracks in mud',
  'A tick on vacation', 'A possum playing dead badly', 'A bored ghost at a campfire', 'A moose stuck in a doorway',
  'A squirrel stealing the car keys', 'A bear raiding the cooler', 'Fishing for compliments', 'The family group chat',
  'Cabin fever', 'A dog who thinks it is a bear', 'Firewood that refuses to light', 'The thing under the dock',
  'A lake monster in sunglasses', 'An owl judging you', 'A mosquito with a straw', 'Leaf peepers',
  'Maple syrup addiction', 'A skunk wearing perfume', 'A Dunkin\' run in a blizzard', 'A very confused lobster in the woods',
  'A snowmobile chase', 'An eye looking up from an ice fishing hole', 'A raccoon heist', 'Sleepwalking into the lake',
  'The dog that ate all the s\'mores', 'A tent collapsing at 3am', 'Snoring like a chainsaw', 'A ghost that only haunts the bathroom',
  'A Sasquatch selfie', 'The last roll of toilet paper', 'The thermostat war', 'A bear in a canoe',
  'Ducks forming a gang', 'A hammock fail', 'Bug spray in the eyes', 'A deer doing taxes',
  'Two dogs plotting', 'The scariest noise in the woods', 'A campfire song nobody asked for', 'Moose road rage',
  'A haunted rocking chair', 'Losing the paddle', 'A bat in the kitchen', 'Someone pretending they are not scared',
  'Hiding from the bear in the outhouse', "Humpty Dumpty's security camera footage", 'The Pumpkin Coach in a drive-thru',
  'A swan boat with teeth', 'Animatronic dance party at 3 AM', 'Bigfoot shopping at the North Conway outlets', 'Traffic on Route 16',
  'The lake monster on a jet ski', 'Skee-Ball champion of Funspot', 'A bear riding a unicycle at Clark\'s', 'Santa\'s elves on strike',
  'Driving the Kanc in a snowstorm', 'Blown off the top of Mount Washington', 'A moose at the Weirs Beach arcade', 'A dinosaur stealing your ice cream', 'Cinderella working the night shift', 'A jumpscare that went wrong', 'A chipmunk with a six-pack', 'Getting dressed in a sleeping bag', 'The worst cabin roommate'
];

// players: true -> the options are the players in the room
export const POLLS = [
  { q: 'Who would get eaten by a bear first?', players: true },
  { q: 'Who would survive the longest alone in the woods?', players: true },
  { q: 'Who is most likely to wander off and get lost?', players: true },
  { q: 'Who would try to befriend the bear instead of running?', players: true },
  { q: 'Who is the worst at starting a campfire?', players: true },
  { q: 'Who would scream the loudest at a spider?', players: true },
  { q: "Who is secretly the dogs' favorite?", players: true },
  { q: "Who would eat the last s'more without asking?", players: true },
  { q: 'Who is first to say "did you hear that?"', players: true },
  { q: 'Who would accidentally burn down the cabin?', players: true },
  { q: 'Who would be the villain in a cabin horror movie?', players: true },
  { q: 'Who hogs the blankets?', players: true },
  { q: 'Who would get jumpscared first?', players: true },
  { q: 'Who would survive five nights at Story Land?', players: true },
  { q: 'Scariest Story Land animatronic after dark?', c: ['Humpty Dumpty', 'Cinderella', 'The swan boats', 'The Pumpkin Coach'] },
  { q: 'Best way to spend a day near Conway?', c: ['Story Land', 'Outlet shopping', 'Hiking the Kanc', 'Napping at the cabin'] },
  { q: 'Best NH road trip stop?', c: ['Funspot', "Clark's Trading Post", 'Flume Gorge', "Santa's Village"] },
  { q: 'Best way to get up Mount Washington?', c: ['Hike it', 'Drive the Auto Road', 'Take the Cog Railway', 'Absolutely not'] },
  { q: 'Best Winnipesaukee activity?', c: ['Boating', 'Weirs Beach arcade', 'Jumping off the dock', 'Ice cream run'] },
  { q: "Best s'more upgrade?", c: ["Reese's cup", 'Double marshmallow', 'Cookies instead of graham', 'Nothing. Classic.'] },
  { q: 'Worst thing to find in the outhouse?', c: ['A spider', 'A snake', 'No toilet paper', 'Another person'] },
  { q: 'Scariest thing in the NH woods?', c: ['Black bears', 'Moose', 'Ticks', 'Whatever is making that noise'] },
  { q: 'Best cabin snack?', c: ['Chips', 'Hot dogs', 'Pancakes with maple syrup', 'Trail mix'] },
  { q: 'The cabin loses power for a week. What goes first?', c: ['Sanity', 'The food', 'Phone batteries', 'Friendships'] },
  { q: 'Best job for a dog at the cabin?', c: ['Guard dog', 'Foot warmer', 'Snack inspector', 'Professional napper'] },
  { q: 'Ideal cabin weekend weather?', c: ['Snowstorm', 'Sunny lake day', 'Crisp foliage day', 'Thunderstorm'] },
  { q: 'Which would you rather fight?', c: ['One Bigfoot', '100 duck-sized moose', 'The Wendigo', 'A swarm of black flies'] },
  { q: "What's ACTUALLY making the noise outside?", c: ['A raccoon', 'A bear', 'Dad', 'Something worse'] },
  { q: 'Best way to survive a horror movie?', c: ['Never split up', "Don't go in the basement", 'Bring the dog', 'Be the funny one'] },
  { q: 'Most essential cabin item?', c: ['Firewood', 'Coffee', 'Bug spray', 'Board games'] },
  { q: "Go-to Dunkin' order?", c: ['Iced coffee, even in winter', 'Hot coffee', 'Munchkins', "I don't go to Dunkin'"] },
  { q: 'Best season in New Hampshire?', c: ['Winter', 'Mud season', 'Summer', 'Fall'] },
  { q: 'Cabin is on fire. What do you grab first?', c: ['The dogs', 'My phone', 'The snacks', 'Other family members'] }
];

// ---------- extra packs (js/packs/) ----------
import TRIVIA_1 from './packs/trivia-1.js';
import TRIVIA_2 from './packs/trivia-2.js';
import TRIVIA_3 from './packs/trivia-3.js';
import TRIVIA_4 from './packs/trivia-4.js';
import PROMPTS_X from './packs/prompts.js';
import PROMPTS_2 from './packs/prompts-2.js';
import POLLS_X from './packs/polls.js';

const key = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
function addUnique(list, extra, keyOf) {
  const seen = new Set(list.map(keyOf));
  for (const item of extra) {
    const k = keyOf(item);
    if (!seen.has(k)) { seen.add(k); list.push(item); }
  }
}
addUnique(TRIVIA, [...TRIVIA_1, ...TRIVIA_2, ...TRIVIA_3, ...TRIVIA_4], t => key(t.q));
addUnique(DRAW_PROMPTS, [...PROMPTS_X, ...PROMPTS_2], key);
addUnique(POLLS, POLLS_X, p => key(p.q));

// ---------- This or That (js/packs/tot-*.js) ----------
import { NATURE, ANIMALS, GEO } from './packs/tot-1.js';
import { HISTORY, MOVIES, GAMES, MUSIC, FOOD } from './packs/tot-2.js';
import { NATURE_2, ANIMALS_2 } from './packs/tot-3.js';
import { GEO_2, HISTORY_2 } from './packs/tot-4.js';
import { MOVIES_2, GAMES_2 } from './packs/tot-5.js';
import { MUSIC_2, FOOD_2 } from './packs/tot-6.js';
import FUN_1 from './packs/tot-fun-1.js';
import FUN_2 from './packs/tot-fun-2.js';

// merge packs per category, dropping exact duplicates (same question and same pair)
const totKey = (x) => `${x.q}|${[x.right, x.wrong].sort().join('|')}`.toLowerCase();
const mergeTot = (...lists) => {
  const seen = new Set();
  return lists.flat().filter(x => { const k = totKey(x); if (seen.has(k)) return false; seen.add(k); return true; });
};
export const TOT = {
  nature: mergeTot(NATURE, NATURE_2), animals: mergeTot(ANIMALS, ANIMALS_2), geo: mergeTot(GEO, GEO_2),
  history: mergeTot(HISTORY, HISTORY_2), movies: mergeTot(MOVIES, MOVIES_2), games: mergeTot(GAMES, GAMES_2),
  music: mergeTot(MUSIC, MUSIC_2), food: mergeTot(FOOD, FOOD_2)
};
// researched "believe it or not" packs, sorted into their categories
for (const x of [...FUN_1, ...FUN_2]) if (TOT[x.cat]) TOT[x.cat] = mergeTot(TOT[x.cat], [x]);

// Sports questions were written into the music lists; pull them out into their own category.
const SPORTS_RE = /sport|ball|olymp|nba|nfl|nhl|team|player|goal|hockey|tennis|golf|soccer|basket|super bowl|stanley|world cup|marathon|medal|race|wimbledon|iditarod|lacrosse|gatorade|jordan|babe ruth|chamberlain|puck|touchdown|home run|slam|dunk|chess|derby|indy 500|tour de france|tarzan|airplane|comaneci/i;
const NOT_SPORTS = new Set(['A guitar', 'A grand piano', 'A violin', 'Michael Jackson', 'Bruce Springsteen', 'Peter Hernandez', 'Paul Hewson', 'Gordon Sumner']);
const isSports = (x) => !NOT_SPORTS.has(x.right) && (SPORTS_RE.test(`${x.q} ${x.right} ${x.wrong} ${x.note || ''}`) || x.right === 'Yao Ming');
TOT.sports = TOT.music.filter(isSports);
TOT.music = TOT.music.filter(x => !isSports(x));

// Boston / New England specific content gets shown rarely (it's too local for most of the table)
const LOCAL_RE = /\b(Boston|Bostonian|Massachusetts|Mass\b|Masshole|New England|Fenway|Red Sox|Patriots|Bruins|Celtics|the Pike|Big Dig|rotary|rotaries|packie|frappe|jimmies|ayuh|wicked|Dunkin|Munchkin|Friendly's|Fribble|Papa Gino|Howard Johnson|HoJo|Cape Cod|Sagamore|Martha's Vineyard|Nantucket|Hyannis|Provincetown|Gloucester|Salem|Walden|Thoreau|Dixville|Piscataqua|Laconia|Concord|Manchester|Nashua|Portsmouth|Dartmouth|Hanover|Montpelier|Augusta|Rhode Island|Lovecraft|Aerosmith|New Kids|Dropkick|Dirty Water|Sweet Caroline|North End|Haahvahd|duck boat|Make Way for Ducklings|Esplanade|Freedom Trail|Vermont|Maine|Connecticut|Kennedy|Weirs|Motorcycle Week|purple finch|Merrimack)\b/i;
export const isLocal = (text) => LOCAL_RE.test(String(text));
