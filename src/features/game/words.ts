// VOTE OUT IMPOSTER — word database. Buttery, Indian-player-friendly everyday
// English only + a memes stash + a famous-people shelf. Architecture: one
// file per category would be ideal for thousands, but a single typed registry
// keeps imports static and tree-shakeable; tiers let difficulty stay real.
// Adding words = appending strings to the right array. Nothing else to touch.

export type Difficulty = 'easy' | 'normal' | 'hard' | 'random';

export interface WordCategory {
  id: string;
  name: string;
  emoji: string;
  /** Famous-name shelf — maintained separately from ordinary words. */
  famous?: boolean;
  /** Meme phrase shelf — punchlines, not dictionary entries. */
  memes?: boolean;
  words: {
    easy: string[];
    normal: string[];
    hard: string[];
  };
}

export const CATEGORIES: WordCategory[] = [
  {
    id: 'food',
    name: 'Food & Drinks',
    emoji: '🍔',
    words: {
      easy: [
        'Pizza', 'Burger', 'Biryani', 'Dosa', 'Idli', 'Samosa', 'Pani Puri', 'Noodles', 'Rice', 'Dal',
        'Chicken', 'Egg', 'Apple', 'Banana', 'Mango', 'Cake', 'Chocolate', 'Ice Cream', 'Tea', 'Coffee',
        'Juice', 'Milk', 'Chapati', 'Paratha', 'Vada Pav', 'Momos', 'Sandwich', 'Fries', 'Popcorn', 'Cookies',
        'Butter Chicken', 'Paneer Tikka', 'Upma', 'Poha', 'Curd', 'Lassi', 'Chai', 'Halwa', 'Pav Bhaji', 'Chole Bhature'
      ,
        'Butter Naan', 'Kothu Parotta', 'Tamato Rice', 'Curd Rice', 'Chicken Fry', 'Masala Omelette', 'Aloo Tikki', 'Corn Chaat', 'Khakhra', 'Dhokla', 'Fafda', 'Misal Pav', 'Prawn Curry', 'Fish Fry', 'Mutton Curry', 'Chapati Roll', 'Plain Omelette', 'Bread Toast'],
      normal: [
        'Masala Dosa', 'Bhel Puri', 'Butter Naan', 'Fried Rice', 'Manchuria', 'Tandoori Chicken',
        'Hakka Noodles', 'Veg Pulao', 'Rasam', 'Gulab Jamun', 'Jalebi', 'Medu Vada', 'Malai Kofta',
        'Aloo Gobi', 'Baingan Bharta', 'Chicken Curry', 'Mysore Pak', 'Falooda', 'Kulfi', 'Egg Roll',
        'Tomato Soup', 'Garlic Bread', 'Chicken Shawarma', 'French Toast', 'Pancakes', 'Waffles', 'Bacon',
        'Burrito', 'Tacos', 'Sushi', 'Ramen'
      ,
        'Bisi Bele Bath', 'Khara Pongal', 'Sweet Corn Soup', 'Chicken 65', 'Egg Curry', 'Fish Curry', 'Karnataka Thali', 'Kerala Parotta', 'Andhra Chilli Chicken', 'Dahi Vada', 'Ragi Mudde', 'Lemon Rice', 'Tamarind Rice', 'Ghee Podi Dosa', 'Bhindi Fry', 'Kadane Ambat'],
      hard: [
        'Karisikaru', 'Jodhuplu Biryani', 'Aam Ka Murabba', 'Cheddar Biscuit',
        'Smoky Chipotle Wrap', 'Pesto Pasta', 'Burrata Salad', 'Zaatar Manakish', 'Kimchi Fried Rice',
        'Bibimbap', 'Ratatouille', 'Samosa Chaat Bowl', 'Palak Paneer Dosa', 'Chettinad Pepper Chicken'
      ]
    }
  },
  {
    id: 'people',
    name: 'People & Jobs',
    emoji: '👤',
    words: {
      easy: [
        'Teacher', 'Doctor', 'Police Officer', 'Chef', 'Actor', 'Singer', 'Cricketer', 'Driver', 'Pilot',
        'Engineer', 'Student', 'Farmer', 'Shopkeeper', 'YouTuber', 'Dancer', 'Nurse', 'Manager', 'Chef',
        'Barber', 'Waiter', 'Babysitter', 'Gardener', 'Maid', 'Soldier'
      ,
        'Mother', 'Father', 'Brother', 'Sister', 'Friend', 'Grandma', 'Grandpa', 'Uncle', 'Aunt', 'Cousin', 'Beggar', 'Sailor'],
      normal: [
        'IA S Officer', 'Software Tester', 'News Anchor', 'Garbage Collector', 'Mechanic', 'Plumber',
        'Electrician', 'Babysitter', 'Bank Cashier', 'Bus Conductor', 'Railway Guard', 'Postman',
        'Fitness Trainer', 'Makeup Artist', 'Photographer', 'Journalist', 'Optician', 'Delivery Guy', 'Taxi Driver'
      ,
        'House Painter', 'Road Sweeper', 'Chai Stall Owner', 'Festival Stall Guy', 'Auto Driver Anna', 'Stitching Aunty', 'Spelling Bee Kid', 'Fishing Boat Crew', 'Morning Walk Uncle', 'Train Station Master', 'Delivery Boy', 'Vegetable Vendor'],
      hard: [
        'Cryptotechnologist', 'Radiologist', 'Seismologist', 'UAV Drone Operator', 'Mortician',
        'Court Interpreter', 'Actuary', 'Archaeologist', 'Sommelier', 'Voice-Over Artist',
        'Forensic Accountant', 'Herpetologist'
      ]
    }
  },
  {
    id: 'everyday',
    name: 'Everyday Life',
    emoji: '🏠',
    words: {
      easy: [
        'House', 'Room', 'Kitchen', 'Bathroom', 'Bed', 'Chair', 'Table', 'Door', 'Window', 'Fan',
        'Light', 'Mirror', 'Clock', 'Phone', 'Charger', 'Bag', 'Shoes', 'Keys', 'Wallet', 'Bottle',
        'Toothbrush', 'Towel', 'Curtain', 'Pillow', 'Blanket', 'Fridge', 'Washing Machine', 'Bucket', 'Broom'
      ,
        'Lock', 'Pen Drive', 'Umbrella Stand', 'Dustbin', 'Plate', 'Spoon', 'Cup', 'Glass', 'Remote', 'Thermos', 'Power Switch'],
      normal: [
        'Pressure Cooker', 'Doormat', 'Sofa Bed', 'Stool', 'Clothesline', 'Innerwear', 'Socks',
        'Shoelaces', 'Comb', 'Hair Dryer', 'Detergent', 'Dish Soap', 'Mop', 'Flashlight', 'Adhesive Tape',
        'Sticky Notes', 'Umbrella', 'Sunglasses', 'Water Filter', 'Gas Stove', 'Dinner Set', 'Apron', 'Cutting Board'
      ,
        'Ceiling Fan Regulator', 'Safety Pin', 'Rubber Band', 'Junk Drawer', 'Coat Hanger', 'Laundry Basket', 'Garage Shelf', 'Water Jug', 'Storage Jar', 'Bathroom Mat', 'Wall Clock Battery', 'Wiper Blade'],
      hard: [
        'Duct Tape Helmet', 'Rotary Cheese Grater', 'Under-Sink Trap', 'Ironing Board Cover', 'Dishwasher Pod',
        'Thermal Pillow', 'Draft Stopper', 'Door Chain Latch', 'Cutlery Organizer', 'Pet Gate'
      ]
    }
  },
  {
    id: 'transport',
    name: 'Transport',
    emoji: '🚗',
    words: {
      easy: [
        'Car', 'Bus', 'Train', 'Metro', 'Bike', 'Scooter', 'Auto', 'Taxi', 'Airplane', 'Ship', 'Bicycle',
        'Rickshaw', 'Boat', 'Ola Cab', 'Uber', 'Helicopter', 'Motorcycle', 'Truck', 'Ambulance', 'Fire Truck'
      ,
        'Cycle Rickshaw', 'Police Van', 'Lorry', 'Mini Bus', 'Cable Car', 'Hand Cart', 'School Van'],
      normal: [
        'Bullet Train', 'Ferry', 'Tram', 'E-Rickshaw', 'Delivery Van', 'Tractor', 'School Van',
        'Intercity Bus', 'Cargo Ship', 'Hot Air Balloon', 'Yacht', 'Police Jeep', 'Compartment Seat', 'Sleeper Coach'
      ,
        'Metro Smartcard', 'Local Train Pass', 'Highway Toll Booth', 'Scooter Kickstand', 'Car Horn', 'Seat Belt', 'Traffic Signal', 'Auto Meter', 'Parking Valet', 'School Bus Stop', 'Petrol Pump'],
      hard: [
        'Catapult Glider', 'Hovercraft', 'Rail Maintenance Vehicle', 'Auto Gyrocopter', 'Diving Bell', 'Gondola Car'
      ]
    }
  },
  {
    id: 'education',
    name: 'School & College',
    emoji: '🏫',
    words: {
      easy: [
        'School', 'College', 'Classroom', 'Teacher', 'Student', 'Exam', 'Book', 'Notebook', 'Pen', 'Pencil',
        'Homework', 'Library', 'Principal', 'Bench', 'Uniform', 'Chalk', 'Board', 'Hangout', 'Schoolbag', 'PE Period'
      ,
        'Exam Hall', 'Report Card', 'Ruler', 'Eraser', 'Calculator', 'Geometry Box', 'School Bell'],
      normal: [
        'Group Project', 'Mock Test', 'Results Day', 'Class Monitor', 'Annual Day', 'PT Teacher',
        'Tuition Centre', 'Hostel Mess', 'Fresher Party', 'Convocation', 'Roll Call', 'Question Bank',
        'Canteen', 'Sports Day', 'Science Fair', 'Internship', 'Time Table', 'Attendance Sheet'
      ,
        'Science Lab Coat', 'Drawing Map', 'Class Photo', 'Mark Sheet', 'Pending Assignment', 'Common Room', 'Final Year Project', 'Bus Pass Concession', 'Detail Hall Ticket', 'Hostel Warden', 'Annual Cultural Fest', 'Value Education Period'],
      hard: [
        'Viva Voce', 'Plagiarism Report', 'Grey Matter Thesis', 'Provisional Certificate', 'Backlog Exam',
        'Peer Mentorship', 'Study Hall Prefect', 'Transfer Certificate'
      ]
    }
  },
  {
    id: 'technology',
    name: 'Technology',
    emoji: '📱',
    words: {
      easy: [
        'Phone', 'Laptop', 'Computer', 'Keyboard', 'Mouse', 'Camera', 'Internet', 'Wi-Fi', 'Charger', 'Headphones',
        'Bluetooth', 'App', 'Game', 'Website', 'Password', 'Gmail', 'Instagram', 'WhatsApp', 'YouTube', 'Google',
        'Speaker', 'Tablet', 'Flash Drive', 'Mobile Data', 'Screenshot'
      ,
        'SIM Card', 'OTP', 'Touchscreen', 'SMS', 'Microphone', 'Screen Recorder'],
      normal: [
        'Power Bank', 'Screen Guard', 'Fingerprint Lock', 'Face Unlock', 'Gaming Controller', 'VR Headset',
        'Smart Watch', 'Fitness Band', '5G Signal', 'System Update', 'Blue Screen', 'Email Spam',
        'Video Call Lag', 'Slow Charging', 'Storage Full', 'Wi-Fi Extender', 'Trackpad', 'Graphics Card'
      ,
        'Battery Saver Mode', 'App Uninstall', 'Tab Switcher', 'QR Scanner', 'File Manager', 'Slow Download Bar', 'Firmware Update', 'Network Reset', 'Voice Assistant', 'Captcha Check', 'Storage Cleaner'],
      hard: [
        'Kernel Panic', 'Thermal Throttling', 'Biometric Bypass', 'Jailbroken iPhone', 'Router Firmware',
        'Garage Experiment Bot', 'Retro Emulator', 'Defragmented HDD', 'Kernel-level Cheat', 'Overclocked GPU'
      ]
    }
  },
  {
    id: 'sports',
    name: 'Sports',
    emoji: '🏏',
    words: {
      easy: [
        'Cricket', 'Football', 'Badminton', 'Tennis', 'Basketball', 'Volleyball', 'Bat', 'Ball', 'Goal',
        'Stadium', 'Player', 'Coach', 'Referee', 'Chess', 'Carroms', 'Table Tennis', 'Running', 'Kabaddi', 'Wrestling'
      ,
        'Goal Post', 'Net', 'Whistle', 'Jersey', 'Trophy', 'Umpire', 'Finish Line'],
      normal: [
        'SLAM Dunk', 'Penalty Kick', 'Hockey Stick', 'Shuttlecock', 'Test Match', 'Death Over',
        'No Ball', 'Free Hit', 'Long Jump', 'Relay Race', 'Goal Keeper', 'Substitute Bench', 'Victory Lap',
        'World Cup Trophy', 'IPL Match', 'Opening Batsman', 'Ranji Trophy'
      ,
        'Marathon Bib', 'Boundary Rope', 'Dugout Seat', 'Tennis Serve', 'Corner Kick', 'Warm-up Lap', 'Scorecard Scorer', 'Penalty Box Gossip', 'Offseason Chill', 'Coin Toss Call'],
      hard: [
        'Mankad Run-Out', 'Switch Hit', 'Silly Mid-On', 'Yarker Delivery', 'Alley-oop', 'Offside Trap',
        'Grand Slam Point', 'Carrom Slam'
      ]
    }
  },
  {
    id: 'places',
    name: 'Places',
    emoji: '🌍',
    words: {
      easy: [
        'School', 'College', 'Hospital', 'Park', 'Beach', 'Airport', 'Railway Station', 'Market', 'Mall',
        'Restaurant', 'Hotel', 'Temple', 'Cinema', 'Office', 'Home', 'Bakery', 'Pharmacy', 'Gym', 'Saloon', 'Lake'
      ,
        'Bus Stand', 'Vegetable Market', 'Parking Lot', 'ATM', 'Fire Station', 'Post Office'],
      normal: [
        'Food Court', 'Ticket Counter', 'Platform 6', 'Oxygen Bar', 'Farmers Market', 'Cyber Café',
        'Studio Apartment', 'Hill Station', 'Viewpoint Point', 'Chai Tapri', 'Bus Depot', 'Rooftop Café',
        'Cobblers Corner', 'Cement Godown', 'Employment Exchange'
      ,
        'Krishna River Ghat', 'Sub Registrar Office', 'Passport Seva Kendra', 'RTO Counter', 'Lottery Stall', 'Country Road', 'Vet Hospital', 'Beyond the Overpass', 'Spice Bazaar', 'Old Quarter Alley'],
      hard: [
        'Sundial Garden', 'Arumuga Museum', 'Superior Court Bench', 'Hypermarket Guarantor', 'Quarry Ridge',
        'County Fairground', 'Underpass Garage'
      ]
    }
  },
  {
    id: 'entertainment',
    name: 'Entertainment',
    emoji: '🎬',
    words: {
      easy: [
        'Movie', 'Song', 'Music', 'Actor', 'Singer', 'Dance', 'Cinema', 'Game', 'Comedy', 'TV', 'YouTube',
        'Avengers', 'Spiderman', 'KGF', 'RRR', 'Pushpa', 'Baahubali', 'Netflix', 'TikTok', 'Bigg Boss', 'Trailer'
      ,
        'Ringtone', 'Ring Light', 'Pop Song', 'Serial Actress', 'Dance Reel'],
      normal: [
        'Intermission Interval', 'First-Day-First-Show', 'Box Office Collection', 'Stand-up Show', 'Robbers Thieves',
        'Movie Review', 'Spoiler Alert', 'Video Essay', 'Fan Theories', 'Post-Credits Scene', 'Weekend Binge',
        'Ticket Sellout', 'Housefull Board', 'Dubbed Version', 'Subtitle Track'
      ,
        'Interval Samosa', 'Village Drama Play', 'Day-Time Serial', 'Motivational Podcast', 'Movie Merch Hoodie', 'Face Paint Match', 'Stand-up Open Mic', 'Karaoke Night', 'Contestant Voting Line', 'Neon Poster Wall'],
      hard: [
        'Anti-Hero Arc', 'Found-footage Film', 'Stunt Coordinator Cameo', 'Live-action Remake',
        'Master-of-Ceremonies Set', 'Rubber Duck Odyssey', 'Symbolist Opera Dream'
      ]
    }
  },
  {
    id: 'animals',
    name: 'Animals',
    emoji: '🐶',
    words: {
      easy: [
        'Dog', 'Cat', 'Lion', 'Tiger', 'Elephant', 'Monkey', 'Horse', 'Cow', 'Goat', 'Rabbit', 'Fish', 'Bird',
        'Snake', 'Bear', 'Parrot', 'Squirrel', 'Puppy', 'Kitten', 'Buffalo', 'Donkey'
      ,
        'Housefly', 'Butterfly', 'Crow', 'Ant', 'Bee'],
      normal: [
        'Peacock', 'Flamingo', 'Gorilla', 'Alligator', 'Ostrich', 'Street Dog', 'Dove Bird',
        'Praying Mantis', 'Homing Pigeon', 'Indigo Cobra', 'Desert Fox', 'Pika', 'Stingray', 'Octopus',
        'Sea Horse', 'Koala', 'Panda Cusulator', 'Chameleon', 'Swan'
      ,
        'Street Cat', 'Palm Squirrel', 'Homing Pigeon', 'Milk Cow Herd', 'Rainbow Lorikeet', 'Fox Hole', 'Worm Trail', 'Toad Crossing', 'Mudskipper', 'Puddle Frog'],
      hard: [
        'Fossa Madagascar', 'Axolotl', 'Pangolin', 'Narwhal', 'Tarsier Goggle', 'Marabou Stork',
        'Vampire Squid', 'Gila Monster', 'Horned Lizard'
      ]
    }
  },
  {
    id: 'famous',
    name: 'Famous People',
    emoji: '⭐',
    famous: true,
    words: {
      easy: [
        'Ronaldo', 'Messi', 'Neymar', 'Virat Kohli', 'MS Dhoni', 'Sachin Tendulkar', ' Rohit Sharma', 'Modi Ji',
        'Donald Trump', 'Joe Biden', 'Elon Musk', 'Bill Gates', 'MrBeast', 'Sundar Pichai', 'SRK', 'Telugu SRK',
        'Chet Bhagat', 'Captain Marvel', 'Iron Man', 'Batman', 'Joker'
      ,
        'Narendra Modi', 'Mahesh Babu', 'Thala Ajith'],
      normal: [
        'Volam Rakshith', 'Vijay', 'Aakanksh', 'Nishanth', 'Bunny Bhai', 'Sunil', 'Ritesh', 'Rishikanth',
        'Thalapathy Vijay', 'Allu Arjun', 'Prabhas', 'SS Rajamouli', 'Anirudh Ravichander', 'Arijit Singh',
        'Tanmay Bhat', 'Triggered Insaan', 'Carry Minati', 'Techno Gamerz', 'Mortal Gaming', 'Karan Aujla'
      ,
        'Sardar Patel', 'Telugu VJ Anchor', 'Sunil Comedy', 'Rocking Star Yash', 'Mammootty', 'Jr NTR', 'KGF Rocky', 'Pawan Kalyan', 'Sunil and Ritesh Duo', 'DJ Shiva', 'Chinnari Mellaga Vundo', 'Mysara Raman', 'Vijetha Hero', 'Allu Sneha Reddy'],
      hard: [
        'VR DEVELOPMENTS', 'The Bangalore Troll Dad', 'Silent Film Era Actress', 'Saturday Night Never-Seen Host',
        'Three-legged Formula Swapdriver', 'Intern Who Said Yes First', 'Uncredited Extra #437'
      ]
    }
  },
  {
    id: 'nature',
    name: 'Nature & Weather',
    emoji: '🌦️',
    words: {
      easy: [
        'Rain', 'Sun', 'Cloud', 'Wind', 'Storm', 'Rainbow', 'River', 'Mountain', 'Tree', 'Flower', 'Garden',
        'Beach', 'Ocean', 'Sky', 'Moon', 'Star', 'Snow', 'Fog', 'Lightning', 'Thunder'
      ,
        'Himalayas', 'Nepal Mountains', 'Bay of Bengal', 'Singapore Fog', 'Ganges River'],
      normal: [
        'Cyclone Warning', 'Monsoon Season', 'Summer Heatwave', 'Drizzle Afternoon', 'Thunderstorm', 'Hail Pellets',
        'Sea Breeze', 'Dusk Horizon', 'Double Rainbow', 'Foggy Morning', 'Cold Wave', 'Dew Drops', 'Humid Air'
      ,
        'Horizon Glow', 'Moonlit Highway', 'Paddy Irrigation Canal', 'Ooty Chill', 'Kerala Backwaters', 'Dal Lake', 'Tenkasi Climate', 'Thar Desert Wind', 'Everest Sherpa', 'Mango Blossom', 'Cotton Tree Fluff'],
      hard: [
        'Derecho Corridor', 'Snow-Rain Viaduct', 'Iridescent Clouds', 'Mistral Wind', 'Heat Index 52', 'Supercell Rotation'
      ]
    }
  },
  {
    id: 'events',
    name: 'Events & Occasions',
    emoji: '🎉',
    words: {
      easy: [
        'Birthday', 'Wedding', 'Festival', 'Holiday', 'Exam', 'Vacation', 'Trip', 'Party', 'Meeting', 'Function',
        'Get-together', 'Picnic', 'Sleepover', 'Movie Night', 'Diwali Party', 'New Year', 'Farewell'
      ,
        'Class Reunion', 'Board Games Night', 'Sunset Picnic', 'Treat Day', 'Pudding Exchange'],
      normal: [
        'Sangeet Night', 'Housewarming Ceremony', 'Baby Shower', 'Mocktail Party', 'Brunch Meetup',
        'Study Group Session', 'Gym Chortle Date', 'Group Photo Ops', 'Student Union Election', 'Coho Feast',
        'Lunch-in-Hand Conference', 'Secret Santa Gift'
      ,
        'Hostel Group Calling', 'Final Exam Temple Run', 'Just Married Rice Storm', 'Farewell Snack Van', 'Neighborhood Bucket List Meetup', 'Community Clean-Up Shift', 'Kirana Owner Meetup', 'Summer Chicken Feast', 'Monday Pudding Perspective', 'Confused Rain Dance'],
      hard: [
        'Inhalation Seance Curveball', 'Quarter-baked Inaugural Hop', 'Synthesis Banquet Gala',
        'Parish Jubilee Roast', 'Spymaster Committee Voting'
      ]
    }
  },
  {
    id: 'india',
    name: 'India Swag',
    emoji: '🇮🇳',
    words: {
      easy: [
        'India', 'Diwali', 'Holi', 'Ganesh', 'Temple', 'Auto', 'Metro', 'Cricket', 'Chai', 'UPA', 'UPI',
        'Rickshaw', 'College', 'Chai Stall', 'Traffic Police', 'Kurta', 'Bindi', 'Besan Ladoo', 'Kannada', 'Telugu'
      ,
        'Dubara', 'Captain Cool Poster', 'Mumbai Vada Pav', 'Vande Bharat', 'Karnataka Sarige'],
      normal: [
        'Paytm Soundbox', 'Dhoti Curve', 'Court Exam Line', 'Bhog Break', 'Festival Sale Rush',
        'August Winds Carry Rain', 'Local Train Peak Hour', 'Ladies Compartment', 'Biryani Craze',
        'Bangalore Traffic', 'Hyderabad Metro', 'Dosti Anthem', 'KOTYA Chip Manger', 'Vada Pani Universe', 'Rasoi Queen',
        'Seesaw of Street Dogs', 'Ten Rupee Karaoke'
      ,
        'Tirupati Laddu', 'Bhagyanagar Blink', 'Banjara Hills Evening', 'Somajiguda Barbecue', 'Begum Bazar Stroll', 'Himayatnagar Swapmeet', 'Mettuguda Metro Madness', 'Anna Burns the Rumor', 'Local Bus Conductor', 'TSRTC Depot', 'Rajahmundry Pushkaram', 'Vizag Beach Wind', 'Karnataka Coffee House', 'Traffic Smooth Operator'],
      hard: [
        'Wakhri Pyar Hukum', 'Mylapore Filter Kaapi', 'Kurukshetra Gambit', 'Jagrata Junction', 'Vande Bharat Snack',
        'Rangiri Hill Trilogy', 'Miyaji Vada Colony'
      ]
    }
  },
  {
    id: 'memes',
    name: 'Telugu Memes',
    emoji: '💀',
    memes: true,
    words: {
      easy: [
        'fahhhhhhhhh', 'sarsarle', 'chaduvukondi firstuuu', 'vundha vundha siggu vundha',
        'emvundhile paduko inka', 'Panduko ra sa**', 'oka roju thinakapothe chavavu le',
        'mass amma mass', 'arey ra ra ra', 'chestunnava em cheddava', 'eluntaanai poke maama'
      ,
        'adhi ra meeku ra vera level', 'big recuitments ra', 'high temperature brother', 'aake debut ra', 'getting ready first'],
      normal: [
        'pepsi ayyii pepsi', 'endi bro comedy', 'siggu ledhu ra', 'ettoora dhaan ra', 'jaffa achhe heluu',
        'relation goal kalava', 'rendu rojullo break', 'ayyo amma athi', 'mass BG round',
        'cheppadu susegadu', 'intlo ga umbawa', 'breakup song edit lo'
      ,
        'okkadu ra legendu', 'ayyo ammamram', 'papa ra salaam anna', 'coffee panipuri master', 'mass background anna', 'telangana fog lamp', 'tonight fun only', 'prementana undandi', 'swarna prashna party', 'butta bhoomalu bounce'],
      hard: [
        'legendary cunning dial tone', 'uncommented vintage laugh', 'honey flowing bracket',
        'speed 2.0 without brakes', 'ambika manthravadham', 'elumanda avantem mana?', 'dhalimbu thadeeparki'
      ]
    }
  }
];

/* ------------------------------ word picking ------------------------------ */

export interface WordPick {
  word: string;
  categoryId: string;
  categoryName: string;
  tier: Exclude<Difficulty, 'random'>;
  /** Stable id for recent-avoidance tracking. */
  id: string;
}

export function allCategoryIds(): string[] {
  return CATEGORIES.map((c) => c.id);
}

/** Expand user selection; 'random' means every category participates. */
export function expandCategories(selection: string[]): WordCategory[] {
  if (!selection.length || selection.includes('random')) return CATEGORIES;
  return CATEGORIES.filter((c) => selection.includes(c.id));
}

function tierFor(difficulty: Difficulty, rng: () => number): Exclude<Difficulty, 'random'> {
  if (difficulty !== 'random') return difficulty;
  const r = rng();
  return r < 0.45 ? 'easy' : r < 0.85 ? 'normal' : 'hard';
}

/**
 * Pick a word honoring tier, category, and recent-word avoidance.
 * recentIds is a bounded list of `${catId}:${word}` ids, most recent LAST.
 * If avoiding recents empties the pool, the pool resets.
 */
export function pickWord(
  selection: string[],
  difficulty: Difficulty,
  recentIds: string[],
  rng: () => number = Math.random
): WordPick {
  const cats = expandCategories(selection);
  if (cats.length === 0) throw new Error('Select at least one category.');
  const recent = new Set(recentIds);
  const candidates: WordPick[] = [];
  const fallback: WordPick[] = [];
  for (const cat of cats) {
    for (const tier of ['easy', 'normal', 'hard'] as const) {
      if (difficulty !== 'random' && tier !== difficulty) continue;
      for (const word of cat.words[tier]) {
        const pick: WordPick = { word, categoryId: cat.id, categoryName: cat.name, tier, id: `${cat.id}:${word}` };
        fallback.push(pick);
        if (!recent.has(pick.id)) candidates.push(pick);
      }
    }
  }
  const pool = candidates.length >= Math.min(8, fallback.length) ? candidates : fallback;
  const chosen = pool[Math.floor(rng() * pool.length)];
  return { ...chosen, tier: difficulty === 'random' ? tierFor(difficulty, rng) : chosen.tier };
}

/**
 * Imposter hint: a THEMED sibling from the same category+tier, guaranteed
 * different from the actual word. Close enough to bluff around, far enough
 * to be wrong. It's the generated hint feeding the optional "imposter hint" toggle.
 */
export function imposterHintWord(pick: WordPick, rng: () => number = Math.random): string {
  const cat = CATEGORIES.find((c) => c.id === pick.categoryId);
  if (!cat) return '…';
  const pool = cat.words[pick.tier].filter((w) => w !== pick.word);
  const fallback = cat.words.easy.filter((w) => w !== pick.word);
  const src = pool.length > 0 ? pool : fallback;
  if (src.length === 0) return '…';
  return src[Math.floor(rng() * src.length)];
}

export const RECENT_WORD_LIMIT = 40;
