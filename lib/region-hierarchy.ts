// World region hierarchy: WorldRegion > Country > State/Province > local Region
// Local region strings must match the `region` field values stored in the DB.

export interface RegionHierarchy {
  [worldRegion: string]: {
    [country: string]: {
      [state: string]: string[]
    }
  }
}

export const REGION_HIERARCHY: RegionHierarchy = {
  'North America': {
    'United States': {
      'California': [
        'San Diego',
        'Orange County',
        'Los Angeles',
        'Ventura',
        'Santa Barbara',
        'Central Coast',
        'Monterey',
        'NorCal',
      ],
      'Hawaii': ['North Shore', 'South Shore', 'East Side', 'West Side', 'Maui', 'Big Island'],
      'Florida': ['South Florida', 'Central Florida', 'Panhandle', 'Space Coast'],
      'North Carolina': ['Outer Banks', 'Wilmington'],
      'Virginia': ['Virginia Beach'],
      'New York': ['Long Island', 'Rockaway', 'Fire Island'],
      'New Jersey': ['Jersey Shore'],
      'Oregon': ['Southern Coast', 'Central Coast', 'Northern Coast'],
      'Washington': ['Olympic Peninsula', 'Southern Coast'],
    },
    'Mexico': {
      'Baja California': ['Ensenada', 'Tijuana', 'Rosarito'],
      'Oaxaca': ['Puerto Escondido', 'Huatulco'],
      'Jalisco': ['Puerto Vallarta'],
    },
    'Costa Rica': {
      'Guanacaste': ['Tamarindo', 'Witch\'s Rock', 'Playa Negra'],
      'Puntarenas': ['Dominical', 'Jaco', 'Pavones'],
    },
    'Puerto Rico': {
      'Northwest': ['Rincon', 'Aguadilla', 'Isabela'],
      'North': ['San Juan', 'Arecibo'],
    },
  },
  'South America': {
    'Brazil': {
      'Rio de Janeiro': ['Ipanema', 'Arpoador', 'Barra da Tijuca'],
      'Santa Catarina': ['Florianópolis', 'Itajaí'],
      'Bahia': ['Itacaré', 'Porto Seguro'],
    },
    'Peru': {
      'Lima': ['Miraflores', 'Barranco', 'La Punta'],
      'La Libertad': ['Huanchaco', 'Pacasmayo'],
    },
    'Chile': {
      'Valparaíso': ['Pichilemu', 'Punta de Lobos', 'Viña del Mar'],
    },
  },
  'Europe': {
    'Portugal': {
      'Algarve': ['Sagres', 'Arrifana', 'Beliche'],
      'Lisboa': ['Ericeira', 'Cascais', 'Costa da Caparica'],
      'Centro': ['Peniche', 'Nazaré', 'Figueira da Foz'],
    },
    'Spain': {
      'Basque Country': ['Mundaka', 'Zarautz', 'San Sebastián'],
      'Canary Islands': ['Lanzarote', 'Fuerteventura', 'Gran Canaria', 'Tenerife'],
      'Galicia': ['Pantín', 'A Coruña'],
    },
    'France': {
      'Nouvelle-Aquitaine': ['Hossegor', 'Biarritz', 'Lacanau', 'Capbreton'],
      'Brittany': ['Quiberon', 'Brest', 'Crozon'],
    },
    'Ireland': {
      'Clare': ['Lahinch', 'Doolin'],
      'Sligo': ['Strandhill', 'Rossnowlagh'],
    },
    'United Kingdom': {
      'Cornwall': ['Newquay', 'Fistral', 'St Ives'],
      'Wales': ['Pembrokeshire', 'Gower'],
      'Scotland': ['Thurso', 'Caithness'],
    },
  },
  'Oceania': {
    'Australia': {
      'New South Wales': ['Sydney Northern Beaches', 'Sydney South', 'Byron Bay', 'Coffs Harbour'],
      'Queensland': ['Gold Coast', 'Sunshine Coast', 'Noosa'],
      'Western Australia': ['Margaret River', 'Perth', 'Esperance'],
      'South Australia': ['Cactus', 'Victor Harbor'],
      'Victoria': ['Torquay', 'Bells Beach', 'Phillip Island'],
    },
    'New Zealand': {
      'Northland': ['Raglan', 'Piha', 'Muriwai'],
      'Gisborne': ['Wainui', 'Makorori'],
    },
  },
  'Asia': {
    'Indonesia': {
      'Bali': ['Kuta', 'Uluwatu', 'Canggu', 'Sanur', 'Medewi', 'Keramas'],
      'West Java': ['Pelabuhan Ratu', 'Cimaja'],
      'Lombok': ['Desert Point', 'Gerupuk', 'Selong Belanak'],
      'Mentawai Islands': ['Padang', 'Lance\'s Left', 'Macaroni\'s'],
    },
    'Philippines': {
      'Siargao': ['Cloud 9', 'Jacking Horse', 'Tuason Point'],
      'La Union': ['San Juan', 'Bacnotan'],
    },
    'Japan': {
      'Chiba': ['Shidashita', 'Onjuku', 'Ichinomiya'],
      'Miyazaki': ['Nichinan', 'Kirishima'],
      'Ibaraki': ['Hitachi', 'Oarai'],
    },
    'Sri Lanka': {
      'Southern Coast': ['Arugam Bay', 'Weligama', 'Hikkaduwa'],
    },
  },
  'Africa': {
    'South Africa': {
      'Eastern Cape': ['Jeffrey\'s Bay', 'East London', 'Port Elizabeth'],
      'Western Cape': ['Cape Town', 'Muizenberg', 'Big Bay'],
      'KwaZulu-Natal': ['Durban', 'Ballito'],
    },
    'Morocco': {
      'Agadir': ['Taghazout', 'Anchor Point', 'Killer Point'],
      'Essaouira': ['Moulay Bouzerktoun'],
    },
    'Canary Islands': {
      'Fuerteventura': ['Corralejo', 'El Cotillo', 'Punta Paloma'],
      'Lanzarote': ['Famara', 'La Santa', 'El Quemao'],
    },
  },
}

/** Flat list of all countries across all world regions */
export function getAllCountries(): string[] {
  return Object.values(REGION_HIERARCHY).flatMap((countries) => Object.keys(countries))
}

/** Get states/provinces for a given country */
export function getStatesForCountry(country: string): string[] {
  for (const worldRegion of Object.values(REGION_HIERARCHY)) {
    if (worldRegion[country]) return Object.keys(worldRegion[country])
  }
  return []
}

/** Get local regions for a given country + state */
export function getRegionsForState(country: string, state: string): string[] {
  for (const worldRegion of Object.values(REGION_HIERARCHY)) {
    if (worldRegion[country]?.[state]) return worldRegion[country][state]
  }
  return []
}

/** Get all local regions for a given country (all states flattened) */
export function getAllRegionsForCountry(country: string): string[] {
  for (const worldRegion of Object.values(REGION_HIERARCHY)) {
    if (worldRegion[country]) {
      return Object.values(worldRegion[country]).flat()
    }
  }
  return []
}

/** Get the world region for a given country */
export function getWorldRegionForCountry(country: string): string | null {
  for (const [worldRegion, countries] of Object.entries(REGION_HIERARCHY)) {
    if (countries[country]) return worldRegion
  }
  return null
}
