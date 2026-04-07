import type { ParkingOption } from '@/types/spot'

export const PARKING_DATA: Record<string, ParkingOption[]> = {

  // ─── SAN DIEGO COUNTY ─────────────────────────────────────────────────────

  'blacks-beach': [
    { name: 'Torrey Pines Gliderport Lot', lat: 32.8897, lng: -117.2531, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–sunset', maxStayHours: null, notes: 'Steep trail to beach. No overnight parking.' },
    { name: 'N. Torrey Pines Rd Street', lat: 32.8930, lng: -117.2500, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: '2-hour limit. Very limited spots.' },
  ],
  'windansea': [
    { name: 'Neptune Place Street', lat: 32.8310, lng: -117.2786, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hour parking limit. Arrive early.' },
    { name: 'Nautilus St Street', lat: 32.8313, lng: -117.2775, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Residential street parking nearby.' },
  ],
  'la-jolla-cove': [
    { name: 'Coast Blvd Metered Parking', lat: 32.8494, lng: -117.2724, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: 'Pay-by-app or meter. 2-hour limit.' },
    { name: 'Girard Ave Lot', lat: 32.8514, lng: -117.2711, type: 'lot', isFree: false, pricePerHour: 2.50, dailyMax: 20, hours: '8am–10pm', maxStayHours: null, notes: 'Paid structure. Walk to beach.' },
  ],
  'ocean-beach-pier': [
    { name: 'Newport Ave Street', lat: 32.7487, lng: -117.2536, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: '2-hour limit in some zones.' },
    { name: 'Abbott St Street', lat: 32.7490, lng: -117.2528, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Residential street parking.' },
  ],
  'sunset-cliffs': [
    { name: 'Sunset Cliffs Blvd', lat: 32.7151, lng: -117.2561, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking along bluff.' },
    { name: 'Ladera St Pullouts', lat: 32.7180, lng: -117.2570, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Small turnouts along the cliffs.' },
  ],
  'pacific-beach-pier': [
    { name: 'Garnet Ave Metered', lat: 32.7978, lng: -117.2527, type: 'street', isFree: false, pricePerHour: 1.50, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: 'Meter parking. 2-hr limit.' },
    { name: 'Mission Blvd Metered', lat: 32.7979, lng: -117.2519, type: 'street', isFree: false, pricePerHour: 1.50, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: 'Pay station required.' },
  ],
  'tourmaline': [
    { name: 'Tourmaline Surfing Park Lot', lat: 32.8097, lng: -117.2611, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Large free lot. No overnight.' },
  ],
  'cardiff-reef': [
    { name: 'Cardiff State Beach Lot', lat: 33.0072, lng: -117.2821, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–8pm', maxStayHours: null, notes: 'State park day-use fee.' },
    { name: 'San Elijo Ave Street', lat: 33.0108, lng: -117.2806, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited free spots on PCH access road.' },
  ],
  'swamis': [
    { name: 'S. Coast Hwy 101 Street', lat: 33.0346, lng: -117.2913, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited — fills by dawn on good days.' },
    { name: 'Swami\'s Bluff Small Lot', lat: 33.0352, lng: -117.2912, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: '4–5 spots only. Arrive before sunrise.' },
  ],
  'moonlight-beach': [
    { name: 'Moonlight Beach Lot', lat: 33.0476, lng: -117.2958, type: 'lot', isFree: false, pricePerHour: 1.00, dailyMax: 12, hours: '6am–10pm', maxStayHours: null, notes: 'Pay at kiosk. First hour free on weekdays.' },
    { name: 'B St Street', lat: 33.0479, lng: -117.2952, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: '2-hour limit. Short walk to beach.' },
  ],
  'grandview': [
    { name: 'Neptune Ave Blufftop', lat: 33.0823, lng: -117.2978, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited spots along the bluff. Walk down stairs to beach.' },
  ],
  'tabletops': [
    { name: 'Carlsbad Blvd Shoulder', lat: 33.1342, lng: -117.3318, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout along PCH.' },
    { name: 'South Carlsbad State Beach Lot', lat: 33.1275, lng: -117.3300, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–9pm', maxStayHours: null, notes: 'State park day-use fee. Walk north to spot.' },
  ],
  'south-carlsbad': [
    { name: 'South Carlsbad State Beach Campground', lat: 33.0968, lng: -117.3265, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–9pm', maxStayHours: null, notes: 'State park day-use fee.' },
  ],
  'oceanside-pier': [
    { name: 'Pier View South Lot', lat: 33.1924, lng: -117.3843, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 8, hours: '8am–10pm', maxStayHours: null, notes: 'City of Oceanside parking lot.' },
    { name: 'Pier View Way Lot', lat: 33.1934, lng: -117.3855, type: 'lot', isFree: false, pricePerHour: 1.00, dailyMax: 8, hours: '8am–10pm', maxStayHours: null, notes: 'Lower rate lot near harbor.' },
    { name: 'Harbor Dr Street', lat: 33.1952, lng: -117.3865, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: 'Free 2-hour street parking.' },
  ],
  'del-mar': [
    { name: 'Del Mar City Beach Lot', lat: 32.9498, lng: -117.2641, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 18, hours: '6am–10pm', maxStayHours: null, notes: 'Summer rates higher. Pay by app.' },
    { name: 'Camino del Mar Metered', lat: 32.9496, lng: -117.2637, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hr meters along main street.' },
  ],
  'solana-beach': [
    { name: 'Fletcher Cove Park Lot', lat: 32.9909, lng: -117.2710, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '5am–10pm', maxStayHours: null, notes: 'Free city parking. Good access via boat launch ramp.' },
  ],
  'torrey-pines': [
    { name: 'Torrey Pines State Beach North Lot', lat: 32.9175, lng: -117.2549, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 12, hours: '7am–sunset', maxStayHours: null, notes: 'State park day-use fee.' },
    { name: 'S. Torrey Pines Dr Pullout', lat: 32.9200, lng: -117.2540, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited free shoulder parking.' },
  ],
  'mission-beach': [
    { name: 'Mission Blvd Metered', lat: 32.7688, lng: -117.2520, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hr meters during day. Free after 8pm.' },
    { name: 'Mission Beach Day Lot', lat: 32.7700, lng: -117.2520, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '8am–midnight', maxStayHours: null, notes: 'Flat-rate lot. Fills early on weekends.' },
  ],
  'imperial-beach': [
    { name: 'IB City Parking Lot', lat: 32.5790, lng: -117.1335, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free city lot near pier.' },
    { name: 'Seacoast Dr Street', lat: 32.5793, lng: -117.1330, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking along the coast.' },
  ],
  'coronado-beach': [
    { name: 'Ocean Blvd Street', lat: 32.6835, lng: -117.1860, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free parking along Coronado beach.' },
    { name: 'Metered Coronado Beach Lot', lat: 32.6835, lng: -117.1850, type: 'lot', isFree: false, pricePerHour: 1.50, dailyMax: null, hours: '8am–6pm', maxStayHours: null, notes: 'Some metered spots near Hotel del Coronado area.' },
  ],

  // Additional San Diego spots
  'ob-dog-beach': [
    { name: 'Voltaire St Street', lat: 32.7560, lng: -117.2527, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking in OB residential area.' },
  ],
  'north-ob': [
    { name: 'Abbott St / Newport Ave', lat: 32.7521, lng: -117.2535, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'OB neighborhood street parking.' },
  ],
  'pb-point': [
    { name: 'Law St / Mission Blvd', lat: 32.8057, lng: -117.2581, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: 'Some 2-hr zones during daytime.' },
  ],
  'mission-bay-jetty': [
    { name: 'South Mission Beach Jetty Area', lat: 32.7500, lng: -117.2527, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking near jetty.' },
  ],
  'north-park-beach': [
    { name: 'Sunset Cliffs Blvd Pullout', lat: 32.7229, lng: -117.2568, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street pullout along bluff road.' },
  ],
  'la-jolla-shores': [
    { name: 'La Jolla Shores Dr Lot', lat: 32.8557, lng: -117.2555, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 20, hours: '6am–10pm', maxStayHours: null, notes: 'City metered lot. Pay at kiosk.' },
    { name: 'La Jolla Shores Dr Street', lat: 32.8560, lng: -117.2550, type: 'street', isFree: false, pricePerHour: 1.50, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hr metered street parking.' },
  ],
  'scripps-pier': [
    { name: 'La Jolla Shores Dr Lot', lat: 32.8663, lng: -117.2545, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 20, hours: '6am–10pm', maxStayHours: null, notes: 'City lot near Scripps Institution of Oceanography.' },
  ],
  'seaside-reef': [
    { name: 'San Elijo State Beach Lot', lat: 33.0020, lng: -117.2786, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–8pm', maxStayHours: null, notes: 'State park day-use fee.' },
  ],
  'san-elijo': [
    { name: 'San Elijo State Beach Campground', lat: 33.0197, lng: -117.2831, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–8pm', maxStayHours: null, notes: 'Day-use fee at state campground entrance.' },
  ],
  'beacons': [
    { name: 'Neptune Ave Blufftop Leucadia', lat: 33.0661, lng: -117.2948, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking. Stairs to beach.' },
  ],
  'stonesteps': [
    { name: 'S Coast Hwy 101 Encinitas', lat: 33.0539, lng: -117.2920, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited street parking. Stone steps down to beach.' },
  ],
  'blacks-canyon': [
    { name: 'Torrey Pines Gliderport Lot', lat: 32.8897, lng: -117.2531, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–sunset', maxStayHours: null, notes: 'Steep cliff descent to beach below.' },
  ],

  // ─── ORANGE COUNTY ────────────────────────────────────────────────────────

  'trestles': [
    { name: 'San Mateo Campground Day-Use Lot', lat: 33.3770, lng: -117.5843, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–8pm', maxStayHours: null, notes: '0.5 mile walk to break. Free with CA State Park pass; otherwise $15/day.' },
  ],
  'san-clemente-pier': [
    { name: 'Pier Bowl Parking Lot', lat: 33.4148, lng: -117.6124, type: 'lot', isFree: false, pricePerHour: 1.00, dailyMax: 8, hours: '6am–10pm', maxStayHours: null, notes: 'City of San Clemente lot.' },
    { name: 'Avenida Del Mar Street', lat: 33.4155, lng: -117.6118, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: 'Free 2-hour street parking.' },
  ],
  'salt-creek': [
    { name: 'Salt Creek Beach Lot', lat: 33.4716, lng: -117.7250, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free Dana Point city parking.' },
  ],
  'doheny': [
    { name: 'Doheny State Beach Lot', lat: 33.4624, lng: -117.6800, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–9pm', maxStayHours: null, notes: 'California State Park day-use fee.' },
  ],
  'trail-6': [
    { name: 'Palisades Dr Street', lat: 33.4462, lng: -117.6704, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited free street parking off PCH.' },
  ],
  'church': [
    { name: 'PCH Shoulder / Montage Area', lat: 33.5131, lng: -117.7576, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited public access. Arrive early.' },
  ],
  'brooks-street': [
    { name: 'Main Beach Lot (Laguna)', lat: 33.5415, lng: -117.7805, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 15, hours: '8am–10pm', maxStayHours: null, notes: 'City of Laguna Beach paid lot.' },
    { name: 'Brooks St Metered', lat: 33.5415, lng: -117.7812, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–10pm', maxStayHours: 2, notes: '2-hr meters on side streets.' },
  ],
  '1000-steps': [
    { name: 'PCH Shoulder (S. Coast Hwy)', lat: 33.4975, lng: -117.7505, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited. Arrive early. Stairs to beach are steep.' },
  ],
  'newport-point': [
    { name: 'Balboa Peninsula Tip Lot', lat: 33.5887, lng: -117.8748, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '5am–midnight', maxStayHours: null, notes: 'Metered April–October. Free rest of year.' },
    { name: 'Channel Rd Street', lat: 33.5890, lng: -117.8756, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free residential street parking.' },
  ],
  'blackies': [
    { name: 'Newport Beach Pier Lot', lat: 33.6198, lng: -117.9296, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'City metered lot.' },
    { name: 'W. Balboa Blvd Metered', lat: 33.6198, lng: -117.9302, type: 'street', isFree: false, pricePerHour: 1.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hr metered street.' },
  ],
  'huntington-beach-pier': [
    { name: 'HB Pier Area Lot (PCH)', lat: 33.6554, lng: -118.0000, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 20, hours: '5am–midnight', maxStayHours: null, notes: 'Surf City USA main lot. Busy on contest weekends.' },
    { name: 'PCH Street Metered', lat: 33.6555, lng: -117.9995, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–10pm', maxStayHours: 2, notes: '2-hour meters along Pacific Coast Hwy.' },
  ],
  'bolsa-chica': [
    { name: 'Bolsa Chica State Beach Lot', lat: 33.7046, lng: -118.0514, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–10pm', maxStayHours: null, notes: 'California State Beach. Long beach with multiple lots.' },
  ],
  'seal-beach-pier': [
    { name: 'Seal Beach Pier City Lot', lat: 33.7400, lng: -118.1055, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–10pm', maxStayHours: null, notes: 'City of Seal Beach metered lot.' },
    { name: 'Main St Metered', lat: 33.7401, lng: -118.1048, type: 'street', isFree: false, pricePerHour: 1.00, dailyMax: null, hours: '8am–6pm', maxStayHours: 2, notes: '2-hr street meters on Main St.' },
  ],
  'cottons': [
    { name: "Cotton's Point PCH Pullout", lat: 33.3611, lng: -117.5715, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Small roadside pullout on PCH. Very limited.' },
  ],
  'san-onofre': [
    { name: 'San Onofre State Beach Lot', lat: 33.3741, lng: -117.5590, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–8pm', maxStayHours: null, notes: 'State park fee. Multiple lots — Old Man\'s, Bluffs, Trails.' },
  ],
  'crystal-cove': [
    { name: 'Crystal Cove State Park Lot', lat: 33.5731, lng: -117.8380, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '6am–8pm', maxStayHours: null, notes: 'State park fee. Reservations recommended on weekends.' },
  ],
  'crescent-bay': [
    { name: 'Crescent Bay Dr Street', lat: 33.5476, lng: -117.7935, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited street parking. Residential area.' },
  ],
  'treasure-island': [
    { name: 'Treasure Island Park Lot', lat: 33.5020, lng: -117.7558, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: 'City of Laguna Beach metered lot.' },
  ],
  'newland-street': [
    { name: 'PCH Metered (Central HB)', lat: 33.6722, lng: -118.0147, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–10pm', maxStayHours: 2, notes: 'Metered street parking on PCH.' },
  ],
  'newport-beach-pier': [
    { name: 'Newport Beach Municipal Lot', lat: 33.6028, lng: -117.9289, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'City metered lot near pier.' },
  ],
  '56th-street-newport': [
    { name: '56th St Newport Beach', lat: 33.6356, lng: -117.9644, type: 'street', isFree: false, pricePerHour: 1.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: 'Metered street spots on Balboa Peninsula.' },
  ],
  'corona-del-mar': [
    { name: 'Corona del Mar State Beach Lot', lat: 33.5960, lng: -117.8720, type: 'lot', isFree: false, pricePerHour: 1.50, dailyMax: 15, hours: '6am–10pm', maxStayHours: null, notes: 'Pay at entry kiosk. Popular summer lot.' },
  ],
  'strands-beach': [
    { name: 'Strands Beach Lot (Dana Point)', lat: 33.4845, lng: -117.7390, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '5am–10pm', maxStayHours: null, notes: 'Free public lot. Elevator to beach.' },
  ],
  'three-arch-bay': [
    { name: 'PCH Shoulder (S. Laguna)', lat: 33.4870, lng: -117.7449, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited. Mostly private community beach.' },
  ],
  'tamarack-carlsbad': [
    { name: 'Tamarack Ave Lot (Carlsbad)', lat: 33.1560, lng: -117.3436, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '6am–10pm', maxStayHours: null, notes: 'City day-use lot at top of beach stairs.' },
  ],

  // ─── LOS ANGELES COUNTY ───────────────────────────────────────────────────

  'el-porto': [
    { name: 'El Porto 45th St', lat: 33.9017, lng: -118.4316, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking in residential El Porto neighborhood.' },
    { name: 'Manhattan Ave (El Porto)', lat: 33.9020, lng: -118.4320, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'No meters. Walk to beach access path.' },
  ],
  'manhattan-beach-pier': [
    { name: 'Manhattan Beach Strand Lot', lat: 33.8853, lng: -118.4147, type: 'lot', isFree: false, pricePerHour: 1.50, dailyMax: 15, hours: '8am–10pm', maxStayHours: null, notes: 'City lot near pier and beach path.' },
    { name: 'Valley Dr Lot', lat: 33.8857, lng: -118.4150, type: 'lot', isFree: false, pricePerHour: 1.00, dailyMax: 10, hours: '8am–10pm', maxStayHours: null, notes: 'Slightly cheaper city lot, 1 block from beach.' },
  ],
  'hermosa-beach': [
    { name: 'Hermosa Ave City Lot', lat: 33.8600, lng: -118.3987, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 12, hours: '6am–midnight', maxStayHours: null, notes: 'City lot on Hermosa Ave.' },
    { name: 'Strand Side Street', lat: 33.8600, lng: -118.3990, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: '2-hour limit 8am–6pm. Walk to beach.' },
  ],
  'redondo-breakwater': [
    { name: 'Redondo Beach Boardwalk Lot', lat: 33.8485, lng: -118.3953, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 12, hours: '6am–midnight', maxStayHours: null, notes: 'City of Redondo Beach paid lot.' },
    { name: 'Esplanade Street', lat: 33.8485, lng: -118.3958, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: '2-hr limit 8am–6pm.' },
  ],
  'RAT-beach': [
    { name: 'Esplanade Pullout (RAT Beach)', lat: 33.8197, lng: -118.3940, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'No official lot. Park along Esplanade Ave. Walk to beach.' },
  ],
  'lunada-bay': [
    { name: 'Paseo del Mar (PV Estates)', lat: 33.7530, lng: -118.4220, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Residential street. Local vibe. Steep trail to bay.' },
  ],
  'point-fermin': [
    { name: 'Point Fermin Park Lot', lat: 33.7042, lng: -118.2920, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '5am–10pm', maxStayHours: null, notes: 'Free city park lot in San Pedro.' },
  ],
  'venice-beach': [
    { name: 'Venice Beach Day Lot', lat: 33.9850, lng: -118.4682, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 25, hours: '8am–midnight', maxStayHours: null, notes: 'LA County beach lot. Rates increase in summer.' },
    { name: 'Pacific Ave Metered', lat: 33.9855, lng: -118.4685, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hr street meters.' },
  ],
  'santa-monica': [
    { name: 'Santa Monica Pier Lot', lat: 34.0082, lng: -118.4970, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 20, hours: '6am–midnight', maxStayHours: null, notes: 'Beach lot off PCH. Cheaper in winter.' },
    { name: 'PCH Lot (Beach Lot 1)', lat: 34.0086, lng: -118.4982, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 12, hours: '6am–midnight', maxStayHours: null, notes: 'City beach lot. Some EV charging.' },
  ],
  'topanga': [
    { name: 'Topanga State Beach Lot', lat: 34.0397, lng: -118.5706, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '7am–sunset', maxStayHours: null, notes: 'Small state beach lot off PCH. Free in winter months.' },
  ],
  'zuma-beach': [
    { name: 'Zuma County Beach Lot', lat: 34.0158, lng: -118.8272, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '7am–7pm', maxStayHours: null, notes: 'LA County beach. Free off-season.' },
  ],
  'malibu': [
    { name: 'Surfrider Beach / Malibu Lagoon Lot', lat: 34.0353, lng: -118.6795, type: 'lot', isFree: false, pricePerHour: 3.00, dailyMax: 12, hours: '8am–8pm', maxStayHours: null, notes: 'State beach lot. Fills very fast on good days.' },
    { name: 'PCH Pullout (North of Surfrider)', lat: 34.0358, lng: -118.6800, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: 'Limited PCH shoulder. 2-hr signs in some areas.' },
  ],
  'leo-carrillo': [
    { name: 'Leo Carrillo State Beach Lot', lat: 34.0456, lng: -118.9346, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 12, hours: '8am–8pm', maxStayHours: null, notes: 'California State Park day-use fee.' },
  ],
  'county-line': [
    { name: 'County Line Pullout (PCH)', lat: 34.0600, lng: -118.9999, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited shoulder parking at the LA/Ventura county line.' },
  ],
  'playa-del-rey': [
    { name: 'Dockweiler State Beach Lot', lat: 33.9480, lng: -118.4440, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 12, hours: '6am–10pm', maxStayHours: null, notes: 'State beach lot by LAX flight path.' },
  ],
  'el-segundo': [
    { name: 'El Segundo Beach Lot', lat: 33.9207, lng: -118.4171, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '6am–10pm', maxStayHours: null, notes: 'Part of Dockweiler State Beach system.' },
  ],
  'nicholas-canyon': [
    { name: 'Nicholas Canyon County Beach Lot', lat: 34.0524, lng: -118.9558, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '7am–7pm', maxStayHours: null, notes: 'LA County beach. Free November–March.' },
  ],
  'el-matador': [
    { name: 'El Matador State Beach Lot', lat: 34.0340, lng: -118.8762, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '8am–sunset', maxStayHours: null, notes: 'Small state lot fills fast. Arrive early. Trail to beach.' },
  ],
  'point-dume': [
    { name: 'Westward Beach Lot (Point Dume)', lat: 34.0144, lng: -118.8159, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '7am–7pm', maxStayHours: null, notes: 'LA County lot at Westward Beach.' },
  ],
  'will-rogers': [
    { name: 'Will Rogers State Beach Lot', lat: 34.0319, lng: -118.5445, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 12, hours: '6am–sunset', maxStayHours: null, notes: 'State beach lot off PCH in Pacific Palisades.' },
  ],
  'rogers-beach': [
    { name: 'El Caballo PCH Pullout', lat: 34.0265, lng: -118.5232, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited PCH shoulder parking.' },
  ],
  'malibu-colony': [
    { name: 'PCH Pullout (Malibu Colony Rd)', lat: 34.0340, lng: -118.6870, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited public access. Second Point area.' },
  ],
  'malibu-third-point': [
    { name: 'PCH Shoulder Near Third Point', lat: 34.0365, lng: -118.6915, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited. Best accessed on foot from Surfrider lot.' },
  ],
  'las-virgenes': [
    { name: 'PCH Escondido Beach Pullout', lat: 34.0394, lng: -118.7635, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Small PCH turnout. Primarily private residences nearby.' },
  ],
  'latigo-point': [
    { name: 'Latigo Canyon Rd PCH Pullout', lat: 34.0417, lng: -118.7944, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited PCH shoulder parking near Latigo Point.' },
  ],
  'paradise-cove': [
    { name: 'Paradise Cove Beach Lot', lat: 34.0033, lng: -118.7885, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 40, hours: '8am–8pm', maxStayHours: null, notes: 'Private lot — expensive ($40/day). Required for beach access.' },
  ],
  'trancas-beach': [
    { name: 'Trancas/Broad Beach PCH Pullout', lat: 34.0283, lng: -118.8553, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited PCH shoulder parking.' },
  ],
  'palos-verdes-cove': [
    { name: 'PV Cove Restricted Access', lat: 33.7453, lng: -118.4140, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Ecological reserve. Very limited. No dedicated lot.' },
  ],
  'abalone-cove': [
    { name: 'Abalone Cove County Beach Lot', lat: 33.7380, lng: -118.3896, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 5, hours: '9am–4pm', maxStayHours: null, notes: 'LA County lot. Small fee. Trail to cove.' },
  ],
  'long-beach-jetty': [
    { name: 'Long Beach Jetty City Lot', lat: 33.7476, lng: -118.1220, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free city lot near Seal Beach jetty.' },
  ],

  // ─── VENTURA COUNTY ───────────────────────────────────────────────────────

  'rincon': [
    { name: 'Rincon Point Small Lot', lat: 34.3736, lng: -119.4730, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free small lot at County Line. Fills before sunrise on good days.' },
    { name: 'Bates Road PCH Pullout', lat: 34.3740, lng: -119.4745, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Additional overflow parking along PCH.' },
  ],
  'pitas-point': [
    { name: 'Pitas Point PCH Pullout', lat: 34.2830, lng: -119.3471, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout on PCH.' },
  ],
  'ventura-pier': [
    { name: 'Ventura City Pier Lot', lat: 34.2684, lng: -119.2948, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '5am–midnight', maxStayHours: null, notes: 'Free city lot near the pier.' },
    { name: 'Harbor Blvd Metered', lat: 34.2687, lng: -119.2945, type: 'street', isFree: false, pricePerHour: 1.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hr metered street parking.' },
  ],
  'c-street': [
    { name: 'Promenade Park Lot (C St)', lat: 34.2752, lng: -119.3038, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free City of Ventura lot. Multiple access points along Promenade.' },
  ],
  'la-conchita': [
    { name: 'PCH Shoulder at La Conchita', lat: 34.3502, lng: -119.4326, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout only. Small cliff community.' },
  ],
  'mussel-shoals': [
    { name: 'PCH Shoulder (Mussel Shoals)', lat: 34.3305, lng: -119.4082, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited PCH pullout.' },
  ],
  'emma-wood': [
    { name: 'Emma Wood State Beach Lot', lat: 34.2858, lng: -119.3655, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 15, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee. Campground at same location.' },
  ],
  'oxnard-shores': [
    { name: 'Oxnard Beach Park Lot', lat: 34.2065, lng: -119.2311, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free City of Oxnard lot.' },
  ],
  'hollywood-beach': [
    { name: 'Mandalay Beach Lot', lat: 34.1960, lng: -119.2181, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free city parking on Ventura County beach strip.' },
  ],
  'point-mugu': [
    { name: 'Point Mugu State Beach Lot', lat: 34.0987, lng: -119.0688, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 12, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee.' },
  ],
  'hobson-beach': [
    { name: 'Hobson County Beach Lot', lat: 34.3117, lng: -119.3948, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 5, hours: '8am–8pm', maxStayHours: null, notes: 'Ventura County beach lot. Low fee.' },
  ],
  'oil-piers': [
    { name: 'PCH Pullout (Oil Piers)', lat: 34.2991, lng: -119.3756, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout along PCH.' },
  ],
  'solimar-beach': [
    { name: 'PCH Shoulder (Solimar)', lat: 34.3204, lng: -119.4030, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited roadside parking on PCH.' },
  ],
  'faria-beach': [
    { name: 'Faria County Beach Lot', lat: 34.3014, lng: -119.3872, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 5, hours: '8am–8pm', maxStayHours: null, notes: 'Ventura County day-use parking.' },
  ],
  'port-hueneme': [
    { name: 'Port Hueneme Beach Park Lot', lat: 34.1478, lng: -119.2013, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free City of Port Hueneme lot.' },
  ],

  // ─── SANTA BARBARA COUNTY ─────────────────────────────────────────────────

  'carpinteria': [
    { name: 'Carpinteria State Beach Lot', lat: 34.3880, lng: -119.5156, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 12, hours: '7am–7pm', maxStayHours: null, notes: 'California State park day-use fee.' },
    { name: 'Carpinteria Ave Street', lat: 34.3882, lng: -119.5152, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: 2, notes: 'Free 2-hour street parking nearby.' },
  ],
  'leadbetter': [
    { name: 'Leadbetter Beach City Lot', lat: 34.4048, lng: -119.7051, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–11pm', maxStayHours: null, notes: 'Free City of Santa Barbara lot. Popular spot — fills early.' },
  ],
  'hammonds': [
    { name: "Hammond's/Butterfly Beach Lot", lat: 34.4092, lng: -119.6332, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free city lot near Four Seasons Biltmore.' },
  ],
  'hendrys': [
    { name: 'Arroyo Burro Beach County Park Lot', lat: 34.4059, lng: -119.7444, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free Santa Barbara County lot. Café on site.' },
  ],
  'campus-point': [
    { name: 'UCSB Lot 13 (Day Permit)', lat: 34.4082, lng: -119.8428, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 3, hours: '7am–5pm', maxStayHours: null, notes: 'UCSB permit required weekdays. Free weekends.' },
  ],
  'coal-oil-point': [
    { name: 'UCSB Coal Oil Point Reserve Lot', lat: 34.4080, lng: -119.8784, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 3, hours: '7am–5pm', maxStayHours: null, notes: 'Small UCSB lot. Free evenings and weekends.' },
  ],
  'stearns-wharf': [
    { name: 'Stearns Wharf Lot', lat: 34.4074, lng: -119.6897, type: 'lot', isFree: false, pricePerHour: 2.50, dailyMax: 15, hours: '6am–midnight', maxStayHours: null, notes: 'Paid lot at the historic wharf.' },
    { name: 'State St Metered', lat: 34.4079, lng: -119.6892, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: 'Street meters near the waterfront.' },
  ],
  'arroyo-burro-west': [
    { name: 'Arroyo Burro Beach County Lot', lat: 34.4044, lng: -119.7493, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free county park lot. West side of creek.' },
  ],
  'sand-spit-sb': [
    { name: 'Santa Barbara Harbor Lot', lat: 34.4062, lng: -119.7204, type: 'lot', isFree: false, pricePerHour: 1.00, dailyMax: 10, hours: '6am–midnight', maxStayHours: null, notes: 'City harbor district lot.' },
  ],
  'rincon-point-sb': [
    { name: 'Rincon Point Lot (SB side)', lat: 34.3769, lng: -119.4759, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Small free lot. Fills by dawn on solid swell.' },
  ],
  'hammonds-point': [
    { name: "Hammond's Point (Miramar) Lot", lat: 34.4119, lng: -119.6443, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free access lot near Miramar area.' },
  ],
  'jalama': [
    { name: 'Jalama Beach County Park Lot', lat: 34.5118, lng: -120.5020, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'Santa Barbara County park fee. Remote 14-mile drive from Hwy 101.' },
  ],
  'gaviota': [
    { name: 'Gaviota State Beach Lot', lat: 34.4709, lng: -120.2273, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee.' },
  ],
  'el-capitan': [
    { name: 'El Capitán State Beach Lot', lat: 34.4587, lng: -120.0206, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–8pm', maxStayHours: null, notes: 'State park fee. Campground nearby.' },
  ],
  'refugio': [
    { name: 'Refugio State Beach Lot', lat: 34.4607, lng: -119.9933, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–8pm', maxStayHours: null, notes: 'State park day-use fee.' },
  ],

  // ─── CENTRAL COAST ────────────────────────────────────────────────────────

  'pismo-beach': [
    { name: 'Pismo Beach Pier Lot', lat: 35.1428, lng: -120.6403, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 15, hours: '8am–10pm', maxStayHours: null, notes: 'City lot near Pismo Pier.' },
    { name: 'Pismo Pier Ave Metered', lat: 35.1432, lng: -120.6407, type: 'street', isFree: false, pricePerHour: 1.50, dailyMax: null, hours: '8am–10pm', maxStayHours: 2, notes: 'Street meters along the beach blvd.' },
  ],
  'shell-beach': [
    { name: 'Shell Beach Rd Lot', lat: 35.1681, lng: -120.6710, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Small free city lot. Limited spaces.' },
  ],
  'cayucos': [
    { name: 'Cayucos State Beach Lot', lat: 35.4433, lng: -120.8960, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Small free lot near the pier.' },
  ],
  'morro-bay': [
    { name: 'Morro Strand State Beach Lot', lat: 35.3648, lng: -120.8658, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee.' },
    { name: 'Coleman Ave Street', lat: 35.3651, lng: -120.8650, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited free street parking.' },
  ],
  'san-simeon': [
    { name: 'Hearst San Simeon State Beach Lot', lat: 35.6406, lng: -121.1931, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free state park lot. Beautiful beach near Hearst Castle.' },
  ],
  'avila-beach': [
    { name: 'Avila Beach Front Lot', lat: 35.1793, lng: -120.7306, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 12, hours: '7am–9pm', maxStayHours: null, notes: 'San Luis Obispo County lot. Walk to beach.' },
    { name: 'Front St Street', lat: 35.1796, lng: -120.7302, type: 'street', isFree: false, pricePerHour: 1.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hr street meters on Front St.' },
  ],
  'oceano-dunes': [
    { name: 'Oceano Dunes SVRA Lot', lat: 35.0934, lng: -120.6230, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 5, hours: '6am–10pm', maxStayHours: null, notes: 'CA State Vehicular Recreation Area permit required.' },
  ],
  'montana-de-oro': [
    { name: 'Montana de Oro State Park Lot', lat: 35.2929, lng: -120.8873, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free lot. Hazard Canyon trail ~0.3mi to beach.' },
  ],
  'cambria-moonstone': [
    { name: 'Moonstone Beach Dr Lot', lat: 35.5783, lng: -121.1095, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free city parking along Moonstone Beach boardwalk.' },
  ],
  'pirates-cove': [
    { name: 'Avila Beach Dr Pullout', lat: 35.1734, lng: -120.7205, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Limited shoulder pullout. Trail down to Pirates Cove.' },
  ],
  'morro-strand': [
    { name: 'Morro Strand State Beach Lot (North)', lat: 35.3942, lng: -120.8704, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park fee. North lot access.' },
  ],
  'atascadero-beach': [
    { name: 'Atascadero Beach Lot', lat: 35.3817, lng: -120.8647, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park fee. Part of Morro Strand area.' },
  ],
  'leffingwell-landing': [
    { name: 'Leffingwell Landing Lot', lat: 35.5657, lng: -121.1067, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free Cambria state park pullout lot.' },
  ],
  'san-simeon-point': [
    { name: 'PCH Shoulder (San Simeon Point)', lat: 35.6490, lng: -121.1990, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout on Hwy 1.' },
  ],
  'cape-san-martin': [
    { name: 'Willow Creek PCH Pullout', lat: 35.8641, lng: -121.4663, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very remote roadside pullout on Big Sur Hwy 1.' },
  ],

  // ─── MONTEREY BAY / SANTA CRUZ ────────────────────────────────────────────

  'asilomar': [
    { name: 'Asilomar State Beach Lot', lat: 36.6203, lng: -121.9384, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free state beach parking off Asilomar Blvd, Pacific Grove.' },
  ],
  'monastery-beach': [
    { name: 'Monastery Beach Hwy 1 Pullout', lat: 36.5226, lng: -121.9266, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free dirt lot on Hwy 1. Dangerous shorebreak — swim at own risk.' },
  ],
  'steamer-lane': [
    { name: 'West Cliff Dr Street', lat: 36.9512, lng: -122.0252, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '7am–7pm', maxStayHours: 2, notes: '2-hour limit during day. Free evenings.' },
    { name: 'Lighthouse Field Lot', lat: 36.9516, lng: -122.0267, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '7am–7pm', maxStayHours: null, notes: 'Free city lot at lighthouse. Limited spots.' },
  ],
  'cowells': [
    { name: 'Santa Cruz Beach Boardwalk Lot', lat: 36.9639, lng: -122.0217, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 15, hours: '8am–midnight', maxStayHours: null, notes: 'City lot near Cowell\'s Beach and boardwalk.' },
    { name: 'Beach St Street', lat: 36.9641, lng: -122.0219, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: 'Metered street near boardwalk.' },
  ],
  'pleasure-point': [
    { name: 'East Cliff Dr Street', lat: 36.9590, lng: -121.9731, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–6pm', maxStayHours: 2, notes: '2-hour limit 8am–6pm. Free evenings.' },
    { name: '36th Ave Blufftop', lat: 36.9592, lng: -121.9738, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free spots on blufftop cross streets.' },
  ],
  'moss-landing': [
    { name: 'Moss Landing State Beach Lot', lat: 36.8044, lng: -121.7858, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free state beach lot off Hwy 1.' },
  ],
  'marina-state-beach': [
    { name: 'Marina State Beach Lot', lat: 36.6811, lng: -121.8012, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free lot. Hang gliding launch area nearby.' },
  ],
  'capitola': [
    { name: 'Capitola City Lot', lat: 36.9768, lng: -121.9510, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 12, hours: '8am–midnight', maxStayHours: null, notes: 'Capitola village paid lot.' },
    { name: 'Esplanade St Metered', lat: 36.9770, lng: -121.9513, type: 'street', isFree: false, pricePerHour: 2.00, dailyMax: null, hours: '8am–10pm', maxStayHours: 2, notes: '2-hr meters along esplanade.' },
  ],
  'natural-bridges': [
    { name: 'Natural Bridges State Beach Lot', lat: 36.9493, lng: -122.0538, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee.' },
  ],
  'scott-creek': [
    { name: 'Scott Creek Hwy 1 Pullout', lat: 37.0540, lng: -122.2542, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout on Hwy 1 south of Davenport.' },
  ],
  'davenport-landing': [
    { name: 'Davenport Landing Rd Lot', lat: 37.0030, lng: -122.1930, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Dirt pullout off Hwy 1 at Davenport Landing Rd.' },
  ],
  'ano-nuevo': [
    { name: 'Año Nuevo State Park Lot', lat: 37.1161, lng: -122.3384, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park lot. Elephant seal reserve — permits required Dec–Mar.' },
  ],
  'steamer-lane-middle-peak': [
    { name: 'West Cliff Dr (Middle Peak)', lat: 36.9516, lng: -122.0265, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '7am–7pm', maxStayHours: 2, notes: 'Free 2-hr street parking on West Cliff Dr.' },
  ],
  '26th-ave-pleasure-point': [
    { name: '26th Ave Street Parking', lat: 36.9575, lng: -121.9801, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free East Cliff Dr side-street parking.' },
  ],
  'the-hook-pleasure-point': [
    { name: '41st Ave Blufftop', lat: 36.9601, lng: -121.9753, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–6pm', maxStayHours: 2, notes: 'Free 2-hour street parking.' },
  ],
  'indicators': [
    { name: 'West Cliff Dr (Lighthouse Area)', lat: 36.9504, lng: -122.0281, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '7am–7pm', maxStayHours: 2, notes: '2-hr limit daytime. Free evenings.' },
  ],
  'manresa-beach': [
    { name: 'Manresa State Beach Lot', lat: 36.9326, lng: -121.9031, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee. Two lots north and south.' },
  ],
  'seacliff-beach': [
    { name: 'Seacliff State Beach Lot', lat: 36.9729, lng: -121.9186, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee. Historic cement ship visible from shore.' },
  ],
  'blacks-point-santa-cruz': [
    { name: 'W Cliff Dr Blufftop', lat: 36.9660, lng: -122.0217, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '7am–7pm', maxStayHours: 2, notes: 'Free 2-hr street parking above cliff.' },
  ],
  'its-beach': [
    { name: "It's Beach Pullout (W Cliff Dr)", lat: 36.9523, lng: -122.0387, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Small free lot. Fills quickly on weekends.' },
  ],
  'waddell-creek': [
    { name: 'Waddell Creek Beach Lot', lat: 37.0944, lng: -122.2817, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free state beach lot. Hanggliding/kite-surfing area.' },
  ],

  // ─── NorCal PACIFICA / SF BAY ─────────────────────────────────────────────

  'linda-mar': [
    { name: 'Linda Mar Beach Lot (Pacifica)', lat: 37.5932, lng: -122.4965, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 5, hours: '6am–10pm', maxStayHours: null, notes: 'Free weekdays; $5 weekends/summer. Large lot fills early.' },
  ],
  'ocean-beach-sf': [
    { name: 'Great Hwy Street Parking', lat: 37.7698, lng: -122.5099, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking along Great Highway. Some spots converted to parklets.' },
  ],
  'fort-point': [
    { name: 'Crissy Field Lot (GGNRA)', lat: 37.8102, lng: -122.4764, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free NPS lot. Walk to Fort Point via bike/walking path.' },
  ],
  'bolinas': [
    { name: 'Bolinas Beach Street', lat: 37.9075, lng: -122.7120, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited. Locals famously remove road signs.' },
  ],
  'stinson-beach': [
    { name: 'Stinson Beach GGNRA Lot', lat: 37.9017, lng: -122.6427, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '7am–6pm', maxStayHours: null, notes: 'Free NPS lot. Fills by mid-morning on sunny weekends.' },
  ],
  'pigeon-point': [
    { name: 'Pigeon Point Lighthouse Lot', lat: 37.1809, lng: -122.3926, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free Hwy 1 lot at lighthouse hostel.' },
  ],
  'pescadero': [
    { name: 'Pescadero State Beach Lot', lat: 37.2679, lng: -122.4106, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park lot. Rarely crowded.' },
  ],
  'half-moon-bay-beach': [
    { name: 'Half Moon Bay State Beach Lot', lat: 37.4561, lng: -122.4365, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park fee. Multiple beach access points.' },
  ],
  'el-granada': [
    { name: 'El Granada Beach Lot', lat: 37.5040, lng: -122.4675, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Small free lot off Hwy 1.' },
  ],
  'sharp-park': [
    { name: 'Sharp Park Beach Lot', lat: 37.6035, lng: -122.4903, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free Pacifica city lot.' },
  ],
  'baker-beach': [
    { name: 'Baker Beach Lot (GGNRA)', lat: 37.7941, lng: -122.4832, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '6am–10pm', maxStayHours: null, notes: 'Free NPS lot. Nudist section at north end.' },
  ],
  'rodeo-beach': [
    { name: 'Rodeo Beach Lot (Marin Headlands)', lat: 37.8322, lng: -122.5410, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: 'Sunrise–sunset', maxStayHours: null, notes: 'Free NPS lot. Colorful pebble beach.' },
  ],
  'muir-beach': [
    { name: 'Muir Beach Lot (GGNRA)', lat: 37.8617, lng: -122.5744, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: 'Sunrise–sunset', maxStayHours: null, notes: 'Free NPS lot. Small cove. Pelican Inn nearby.' },
  ],
  'pacifica-rockaway': [
    { name: 'Rockaway Beach Lot', lat: 37.6137, lng: -122.4868, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '5am–midnight', maxStayHours: null, notes: 'Free city of Pacifica lot.' },
  ],
  'princeton-jetty': [
    { name: 'Princeton-by-the-Sea Lot', lat: 37.4957, lng: -122.4932, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free harbor lot. ~0.5 mile walk/paddle to break. Shuttle runs on contest days.' },
  ],
  'dunes-beach-hmb': [
    { name: 'Half Moon Bay State Beach Lot (Dunes)', lat: 37.4379, lng: -122.4339, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 10, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee.' },
  ],
  'kings-beach-sf': [
    { name: "Kelly's Cove / Great Hwy Street", lat: 37.7593, lng: -122.5100, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking on Great Highway.' },
  ],
  'noriega-ob': [
    { name: 'Noriega St / Great Hwy Street', lat: 37.7545, lng: -122.5099, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking on Great Highway at Noriega.' },
  ],
  'china-beach-sf': [
    { name: 'China Beach Lot (GGNRA)', lat: 37.7876, lng: -122.4867, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: 'Sunrise–sunset', maxStayHours: null, notes: 'Small free NPS lot. Hidden gem in Sea Cliff neighborhood.' },
  ],
  'cronkhite-beach': [
    { name: 'Cronkhite Beach Lot (Marin Headlands)', lat: 37.8327, lng: -122.5278, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: 'Sunrise–sunset', maxStayHours: null, notes: 'Free NPS lot in Marin Headlands.' },
  ],
  'kent-island': [
    { name: 'Agate Beach / Mesa Rd (Bolinas)', lat: 37.9176, lng: -122.7219, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Street parking along Mesa Rd above Agate Beach.' },
  ],
  'palomarin': [
    { name: 'Palomarin Trailhead Lot', lat: 37.9428, lng: -122.7520, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free GGNRA trailhead lot. Walk to beach.' },
  ],

  // ─── NorCal SONOMA COUNTY ─────────────────────────────────────────────────

  'salmon-creek': [
    { name: 'Salmon Creek State Beach Lot', lat: 38.3483, lng: -123.0640, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: 'Sunrise–sunset', maxStayHours: null, notes: 'CA State Beach lot.' },
  ],
  'doran-beach': [
    { name: 'Doran County Beach Lot', lat: 38.3185, lng: -123.0559, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 7, hours: '8am–sunset', maxStayHours: null, notes: 'Sonoma County Regional Park fee.' },
  ],
  'goat-rock': [
    { name: 'Goat Rock State Beach Lot', lat: 38.4456, lng: -123.1320, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free state park lot at Russian River mouth. Seal pupping area.' },
  ],
  'portuguese-beach-bodega': [
    { name: 'Portuguese Beach Lot (Bodega Bay)', lat: 38.3268, lng: -123.0676, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free state beach lot.' },
  ],
  'gualala': [
    { name: 'Gualala Point Regional Park Lot', lat: 38.7716, lng: -123.5244, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '8am–sunset', maxStayHours: null, notes: 'Sonoma County Regional Park fee.' },
  ],
  'sea-ranch': [
    { name: 'Sea Ranch Public Beach Access', lat: 38.7002, lng: -123.4806, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Small public access lot within Sea Ranch community.' },
  ],
  'stewarts-point': [
    { name: "Stewart's Point Hwy 1 Pullout", lat: 38.6480, lng: -123.3938, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout on Hwy 1.' },
  ],
  'fort-ross': [
    { name: 'Fort Ross State Historic Park Lot', lat: 38.5143, lng: -123.2436, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '10am–4:30pm', maxStayHours: null, notes: 'State park fee. Walk to cove.' },
  ],
  'arena-cove': [
    { name: 'Arena Cove Lot (Point Arena)', lat: 38.9121, lng: -123.7035, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free public lot at Point Arena Pier.' },
  ],
  'point-arena': [
    { name: 'Point Arena Lighthouse Lot', lat: 38.9135, lng: -123.6943, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 5, hours: '10am–3:30pm', maxStayHours: null, notes: 'Small fee for lighthouse. Hike down to break.' },
  ],

  // ─── NorCal MENDOCINO COUNTY ──────────────────────────────────────────────

  'navarro-beach': [
    { name: 'Navarro Beach Lot', lat: 39.1817, lng: -123.7566, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free beach lot off Hwy 128 at coast.' },
  ],
  'albion-river': [
    { name: 'Albion Cove Hwy 1 Pullout', lat: 39.2259, lng: -123.7651, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Small roadside pullout.' },
  ],
  'van-damme-beach': [
    { name: 'Van Damme State Beach Lot', lat: 39.2741, lng: -123.7892, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee.' },
  ],
  'mendocino-bay': [
    { name: 'Big River Hwy 1 Pullout', lat: 39.3052, lng: -123.7994, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout near Big River mouth.' },
  ],
  'russian-gulch': [
    { name: 'Russian Gulch State Park Lot', lat: 39.3299, lng: -123.8073, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '8am–sunset', maxStayHours: null, notes: 'State park day-use fee.' },
  ],
  'caspar-beach': [
    { name: 'Caspar Beach Campground', lat: 39.3657, lng: -123.8187, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '8am–sunset', maxStayHours: null, notes: 'Day-use fee for campground lot.' },
  ],
  'fort-bragg-noyo': [
    { name: 'Glass Beach Access Lot', lat: 39.4232, lng: -123.8098, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free city lot near Glass Beach.' },
  ],
  'ten-mile-beach': [
    { name: 'MacKerricher State Park Lot', lat: 39.5348, lng: -123.8073, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '8am–sunset', maxStayHours: null, notes: 'State park fee. Long stretch of beach.' },
  ],
  'elk-mendocino': [
    { name: 'Elk Creek Road Access', lat: 39.1253, lng: -123.7162, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Very limited roadside parking. Difficult cliff access.' },
  ],
  'wages-creek': [
    { name: 'Wages Creek State Beach Lot', lat: 39.6386, lng: -123.7943, type: 'lot', isFree: false, pricePerHour: null, dailyMax: 8, hours: '8am–sunset', maxStayHours: null, notes: 'State beach with campground.' },
  ],

  // ─── NorCal HUMBOLDT COUNTY ───────────────────────────────────────────────

  'trinidad': [
    { name: 'Trinidad State Beach Lot', lat: 41.0571, lng: -124.1459, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '8am–sunset', maxStayHours: null, notes: 'Free state beach lot in charming fishing village.' },
  ],
  'clam-beach': [
    { name: 'Clam Beach Humboldt County Lot', lat: 40.9489, lng: -124.1262, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free county lot. Long beach walk.' },
  ],
  'centerville-beach': [
    { name: 'Centerville Beach County Lot', lat: 40.5710, lng: -124.3192, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free Humboldt County lot near Ferndale.' },
  ],
  'shelter-cove': [
    { name: 'Shelter Cove Lot (Lost Coast)', lat: 40.0196, lng: -124.0697, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free remote lot. Very long drive on winding roads.' },
  ],
  'big-lagoon': [
    { name: 'Big Lagoon County Park Lot', lat: 41.1253, lng: -124.1361, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free Humboldt County park lot.' },
  ],
  'moonstone-beach-humboldt': [
    { name: 'Moonstone Beach Pullout', lat: 41.0410, lng: -124.1438, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free roadside pullout near Trinidad area.' },
  ],
  'eureka-beach': [
    { name: 'King Salmon Beach Lot', lat: 40.7183, lng: -124.2475, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free lot near Eureka. Industrial area.' },
  ],
  'luffenholtz': [
    { name: 'Luffenholtz Beach Pullout', lat: 41.0130, lng: -124.1351, type: 'pullout', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Roadside pullout south of Trinidad.' },
  ],
  'arcata-community-forest-beach': [
    { name: 'Samoa Beach Lot', lat: 40.8602, lng: -124.1699, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free lot on Samoa Peninsula near Arcata.' },
  ],

  // ─── ICONIC / WORLD-CLASS ─────────────────────────────────────────────────

  'mavericks': [
    { name: 'Pillar Point Harbor Lot', lat: 37.4957, lng: -122.4932, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free harbor lot. ~0.5 mile walk/paddle to break. Shuttle runs on contest days.' },
  ],
  'pipeline': [
    { name: 'Ehukai Beach Park Lot', lat: 21.6647, lng: -158.0530, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: 'Dawn–dusk', maxStayHours: null, notes: 'Free Hawaii state park lot. Very busy winter swell season.' },
    { name: 'Ke Nui Rd Street', lat: 21.6647, lng: -158.0528, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street parking in residential area.' },
  ],
  'sunset-beach': [
    { name: 'Sunset Beach Park Lot', lat: 21.6781, lng: -158.0390, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: 'Dawn–dusk', maxStayHours: null, notes: 'Free Hawaii state park lot. North Shore Oahu.' },
  ],
  'cocoa-beach': [
    { name: 'Cocoa Beach Pier Lot', lat: 28.3200, lng: -80.6072, type: 'lot', isFree: false, pricePerHour: 1.00, dailyMax: 8, hours: '7am–9pm', maxStayHours: null, notes: 'City of Cocoa Beach paid lot near Ron Jon Surf Shop.' },
    { name: 'Atlantic Ave Street', lat: 28.3203, lng: -80.6074, type: 'street', isFree: false, pricePerHour: 1.00, dailyMax: null, hours: '8am–8pm', maxStayHours: 2, notes: '2-hr metered parking.' },
  ],
  'outer-banks': [
    { name: 'Cape Hatteras National Seashore Lot', lat: 35.2168, lng: -75.5233, type: 'lot', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free NPS lot. Multiple access points along Hatteras.' },
  ],
  'hossegor': [
    { name: 'Hossegor South Beach Lot', lat: 43.6639, lng: -1.4324, type: 'lot', isFree: false, pricePerHour: 2.00, dailyMax: 12, hours: '8am–8pm', maxStayHours: null, notes: 'Paid in summer, free off-season. WSL CT venue.' },
    { name: 'Rue du Tour du Lac Street', lat: 43.6641, lng: -1.4328, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free street in off-season.' },
  ],
  'uluwatu': [
    { name: 'Uluwatu Temple Parking', lat: -8.8196, lng: 115.0852, type: 'lot', isFree: false, pricePerHour: null, dailyMax: null, hours: '7am–7pm', maxStayHours: null, notes: '20,000–30,000 IDR (~$1.50–2). Warung operators may charge extra.' },
    { name: 'Pecatu Indah Resort Rd', lat: -8.8194, lng: 115.0856, type: 'street', isFree: true, pricePerHour: null, dailyMax: null, hours: '24hr', maxStayHours: null, notes: 'Free roadside parking near resort entrance.' },
  ],
}
