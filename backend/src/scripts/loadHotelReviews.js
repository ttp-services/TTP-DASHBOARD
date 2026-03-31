// ─── TravelTrustIt Hotel Reviews ETL ─────────────────────────────────────────
// Loads reviews for all 423 Solmar hotels into HotelReviews + HotelRatings tables
// Run: node src/scripts/loadHotelReviews.js
// ─────────────────────────────────────────────────────────────────────────────

import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const TTI_API_KEY = 'TTI-7224C177-4E45-4DBB-A909633B-608FF2BA';
const TTI_BASE    = 'https://api.traveltrustit.com';
const DELAY_MS    = 500; // delay between API calls to avoid rate limiting

// ─── DB CONFIG ────────────────────────────────────────────────────────────────
const dbConfig = {
  server:   process.env.DB_SERVER   || 'ttpserver.database.windows.net',
  database: process.env.DB_NAME     || 'TTPDatabase',
  user:     process.env.DB_USER     || 'ttp_admin',
  password: process.env.DB_PASSWORD || 'Fzc0@DXB',
  options:  { encrypt: true, trustServerCertificate: false },
  connectionTimeout: 30000,
  requestTimeout:    30000,
};

const HOTELS = [
  {"solmar_code":"ALBALB","name":"Albir Playa & Spa","tti_code":"A35209","country":"ES"},
  {"solmar_code":"ALBKAK","name":"Kaktus Albir","tti_code":"A23447","country":"ES"},
  {"solmar_code":"ALBROB","name":"Rober Palas","tti_code":"A72404","country":"ES"},
  {"solmar_code":"ALBSUN","name":"Sun Palace Albir and Spa","tti_code":"A78565","country":"ES"},
  {"solmar_code":"ALCALC","name":"Hotel 30Degrees Alcossebre","tti_code":"A71220","country":"ES"},
  {"solmar_code":"ALCBEA","name":"Alcudia Beach","tti_code":"A10502","country":"ES"},
  {"solmar_code":"ALCEUR","name":"Aparthotel Eurhostal","tti_code":"A8673","country":"ES"},
  {"solmar_code":"ALCFUE","name":"Gran Hotel Las Fuentes","tti_code":"A26944","country":"ES"},
  {"solmar_code":"ALCGAR","name":"Alcudia garden","tti_code":"A30875","country":"ES"},
  {"solmar_code":"ALCROM","name":"Romana","tti_code":"A27211","country":"ES"},
  {"solmar_code":"ALCSEA","name":"Alcossebre Sea Experience","tti_code":"A93964","country":"ES"},
  {"solmar_code":"ALCVIV","name":"Viva Sunrise","tti_code":"A10524","country":"ES"},
  {"solmar_code":"ALFMAG","name":"Magic Robin Hood","tti_code":"A79618","country":"ES"},
  {"solmar_code":"ALIALB","name":"Albahia tennis and business","tti_code":"A82463","country":"ES"},
  {"solmar_code":"ALICAS","name":"Castilla Alicante","tti_code":"A4612","country":"ES"},
  {"solmar_code":"ALIELP","name":"El plantio golf resort","tti_code":"A70673","country":"ES"},
  {"solmar_code":"ALIGOL","name":"Alicante Golf","tti_code":"A67791","country":"ES"},
  {"solmar_code":"ALIMAY","name":"Maya Alicante","tti_code":"A23430","country":"ES"},
  {"solmar_code":"ALIMEL","name":"Melia Alicante","tti_code":"A23431","country":"ES"},
  {"solmar_code":"ALMSUI","name":"Suites Albayzin del Mar","tti_code":"A7565","country":"ES"},
  {"solmar_code":"ALROHE","name":"Olympia events and spa","tti_code":"A42486","country":"ES"},
  {"solmar_code":"ALTCAP","name":"Cap Negret","tti_code":"A4287","country":"ES"},
  {"solmar_code":"ALTTAM","name":"Tamarit beach resort","tti_code":"A5105","country":"ES"},
  {"solmar_code":"BARABB","name":"Abba sants","tti_code":"A32266","country":"ES"},
  {"solmar_code":"BARARI","name":"Mariano Cubi","tti_code":"A31109","country":"ES"},
  {"solmar_code":"BARBAL","name":"Balmoral","tti_code":"A72566","country":"ES"},
  {"solmar_code":"BARBAR","name":"Ohla Barcelona","tti_code":"A93418","country":"ES"},
  {"solmar_code":"BARBIT","name":"Vincci Bit","tti_code":"A78713","country":"ES"},
  {"solmar_code":"BARCAA","name":"Catalonia diagonal centro","tti_code":"A32053","country":"ES"},
  {"solmar_code":"BARCAL","name":"Catalonia park putxet","tti_code":"A30002","country":"ES"},
  {"solmar_code":"BARCAS","name":"H10 Casanova","tti_code":"A47433","country":"ES"},
  {"solmar_code":"BARCAT","name":"Catalonia Barcelona plaza","tti_code":"A33324","country":"ES"},
  {"solmar_code":"BARCOL","name":"Colonial Barcelona","tti_code":"A60895","country":"ES"},
  {"solmar_code":"BARCUI","name":"Ciutadella Barcelona","tti_code":"A78701","country":"ES"},
  {"solmar_code":"BARDEM","name":"Del Mar","tti_code":"A26965","country":"ES"},
  {"solmar_code":"BARDIP","name":"Sansi diputacio","tti_code":"A31073","country":"ES"},
  {"solmar_code":"BAREUR","name":"Eurhotel Barcelona diagonal port","tti_code":"A32260","country":"ES"},
  {"solmar_code":"BARGOL","name":"The Golden Barcelona","tti_code":"A87728","country":"ES"},
  {"solmar_code":"BARGRA","name":"Gran Barcino","tti_code":"A31072","country":"ES"},
  {"solmar_code":"BARINC","name":"Vincci Maritimo","tti_code":"A61478","country":"ES"},
  {"solmar_code":"BARITA","name":"H10 Itaca","tti_code":"A32262","country":"ES"},
  {"solmar_code":"BARLAF","name":"Gran La Florida 5 GL","tti_code":"A31086","country":"ES"},
  {"solmar_code":"BARMAI","name":"H10 Marina Barcelona","tti_code":"A31058","country":"ES"},
  {"solmar_code":"BARMED","name":"Medinaceli","tti_code":"A40868","country":"ES"},
  {"solmar_code":"BARNOU","name":"Nouvel","tti_code":"A31098","country":"ES"},
  {"solmar_code":"BARRAB","name":"Ramblas Barcelona","tti_code":"A30896","country":"ES"},
  {"solmar_code":"BARROS","name":"Evenia Rossello","tti_code":"A32272","country":"ES"},
  {"solmar_code":"BARSAN","name":"Santa Marta Barcelona","tti_code":"A31933","country":"ES"},
  {"solmar_code":"BARSEN","name":"Senator Barcelona spa","tti_code":"A33341","country":"ES"},
  {"solmar_code":"BARURQ","name":"H10 Urquinaona Plaza","tti_code":"A75039","country":"ES"},
  {"solmar_code":"BARVIL","name":"Vilamari","tti_code":"A32265","country":"ES"},
  {"solmar_code":"BARVIN","name":"Vincci Gala","tti_code":"A78706","country":"ES"},
  {"solmar_code":"BARVNC","name":"Vincci mae","tti_code":"A32058","country":"ES"},
  {"solmar_code":"BECBER","name":"Bersoca","tti_code":"A93969","country":"ES"},
  {"solmar_code":"BECTRA","name":"Tramontana","tti_code":"A93971","country":"ES"},
  {"solmar_code":"BENALA","name":"Los Alamos","tti_code":"A4389","country":"ES"},
  {"solmar_code":"BENAMA","name":"Amalia by Mc","tti_code":"A4294","country":"ES"},
  {"solmar_code":"BENBEC","name":"Benidorm Centre","tti_code":"A30494","country":"ES"},
  {"solmar_code":"BENBEP","name":"Hotel Mercure","tti_code":"A4305","country":"ES"},
  {"solmar_code":"BENBRI","name":"Hotel Bristol","tti_code":"A28953","country":"ES"},
  {"solmar_code":"BENCIM","name":"Cimbel","tti_code":"A4324","country":"ES"},
  {"solmar_code":"BENDUN","name":"Les Dunes Comodoro","tti_code":"A4384","country":"ES"},
  {"solmar_code":"BENFIE","name":"Fiesta Park","tti_code":"A4355","country":"ES"},
  {"solmar_code":"BENGEM1","name":"Gemelos 1","tti_code":"A93952","country":"ES"},
  {"solmar_code":"BENGEM2","name":"Gemelos 2","tti_code":"A4364","country":"ES"},
  {"solmar_code":"BENGEM20","name":"Gemelos 20","tti_code":"A8553","country":"ES"},
  {"solmar_code":"BENHEL","name":"Helios Benidorm","tti_code":"A4373","country":"ES"},
  {"solmar_code":"BENKAK","name":"Benikaktus","tti_code":"A4304","country":"ES"},
  {"solmar_code":"BENLEH","name":"Levante club hotel and spa","tti_code":"A36941","country":"ES"},
  {"solmar_code":"BENLER","name":"Levante Club Resort","tti_code":"A4386","country":"ES"},
  {"solmar_code":"BENLID","name":"Lido Benidorm","tti_code":"A4388","country":"ES"},
  {"solmar_code":"BENMAC","name":"Marconi","tti_code":"A28453","country":"ES"},
  {"solmar_code":"BENMAD","name":"Madeira Centro","tti_code":"A4401","country":"ES"},
  {"solmar_code":"BENMAG","name":"Magic Aqua Rock Gardens","tti_code":"A4467","country":"ES"},
  {"solmar_code":"BENMAR","name":"Maryciel by Mc","tti_code":"A4400","country":"ES"},
  {"solmar_code":"BENMEL","name":"Melia","tti_code":"A26866","country":"ES"},
  {"solmar_code":"BENMIL","name":"Milord's Suites","tti_code":"A30465","country":"ES"},
  {"solmar_code":"BENMOB","name":"Moby Dick","tti_code":"A4411","country":"ES"},
  {"solmar_code":"BENMON","name":"Montemar","tti_code":"A4413","country":"ES"},
  {"solmar_code":"BENNAA","name":"Magic Natura Animal Waterpark and Polynesian Lodge","tti_code":"A76463","country":"ES"},
  {"solmar_code":"BENNAT","name":"Magic natura animal waterpark and polynesian lodge","tti_code":"A76463","country":"ES"},
  {"solmar_code":"BENOAS","name":"Oasis Plaza","tti_code":"A93963","country":"ES"},
  {"solmar_code":"BENPAR","name":"Paraiso Centro","tti_code":"A4421","country":"ES"},
  {"solmar_code":"BENPLA","name":"Benidorm Plaza","tti_code":"A4332","country":"ES"},
  {"solmar_code":"BENPON","name":"H10 Porto Poniente","tti_code":"A90475","country":"ES"},
  {"solmar_code":"BENPOP","name":"Poseidon Playa","tti_code":"A27355","country":"ES"},
  {"solmar_code":"BENPOR","name":"Port Benidorm","tti_code":"A4390","country":"ES"},
  {"solmar_code":"BENPOS","name":"Poseidon Resort","tti_code":"A4430","country":"ES"},
  {"solmar_code":"BENPRE","name":"Presidente","tti_code":"A4431","country":"ES"},
  {"solmar_code":"BENPRI","name":"Prince Park","tti_code":"A4434","country":"ES"},
  {"solmar_code":"BENREG","name":"Medplaya Regente","tti_code":"A64655","country":"ES"},
  {"solmar_code":"BENROO","name":"Roybel Aptos","tti_code":"A7193","country":"ES"},
  {"solmar_code":"BENROS","name":"Rosamar","tti_code":"A4439","country":"ES"},
  {"solmar_code":"BENROY","name":"Hotel Royal","tti_code":"A4442","country":"ES"},
  {"solmar_code":"BENSOL","name":"Sol Pelicanos Ocas","tti_code":"A4451","country":"ES"},
  {"solmar_code":"BENVIN","name":"Viña del Mar","tti_code":"A4474","country":"ES"},
  {"solmar_code":"BLABEV","name":"Beverly Park & Spa","tti_code":"A5257","country":"ES"},
  {"solmar_code":"BLABLC","name":"Blaucel","tti_code":"A31287","country":"ES"},
  {"solmar_code":"BLABLM","name":"Blaumar Blanes","tti_code":"A5260","country":"ES"},
  {"solmar_code":"BLABOI","name":"Checkin Blanes (former Boixmar)","tti_code":"A5261","country":"ES"},
  {"solmar_code":"BLAEUR","name":"Europa","tti_code":"A5274","country":"ES"},
  {"solmar_code":"BLAPIM","name":"Pimar & Spa","tti_code":"A5322","country":"ES"},
  {"solmar_code":"BLASTE","name":"Stella Maris","tti_code":"A5362","country":"ES"},
  {"solmar_code":"BMDBMD","name":"Best Benalmádena","tti_code":"A28720","country":"ES"},
  {"solmar_code":"BMDBOL","name":"Las Arenas","tti_code":"A7586","country":"ES"},
  {"solmar_code":"BMDPAL","name":"Palmasol","tti_code":"A7590","country":"ES"},
  {"solmar_code":"BMDSIR","name":"Best Siroco","tti_code":"A7607","country":"ES"},
  {"solmar_code":"BMDSUN","name":"Sunset Beach Club Aptos","tti_code":"A7611","country":"ES"},
  {"solmar_code":"BMDTOR","name":"Estival Torrequebrada","tti_code":"A7613","country":"ES"},
  {"solmar_code":"BMDTRI","name":"Best Triton","tti_code":"A7614","country":"ES"},
  {"solmar_code":"CADETC","name":"Club es talaial calimera","tti_code":"A10184","country":"ES"},
  {"solmar_code":"CADMAR","name":"Marsenses Ferrera Blanca","tti_code":"A10185","country":"ES"},
  {"solmar_code":"CAFALO","name":"Alone","tti_code":"A75736","country":"ES"},
  {"solmar_code":"CAFMAG","name":"Magic Tropical Splash","tti_code":"A4412","country":"ES"},
  {"solmar_code":"CAIDUN","name":"Dunas Hipotels","tti_code":"A29136","country":"ES"},
  {"solmar_code":"CAIGAR","name":"Cala Millor Garden","tti_code":"A31475","country":"ES"},
  {"solmar_code":"CAIHIP","name":"Hipotels Mercedes","tti_code":"A28961","country":"ES"},
  {"solmar_code":"CALAMA","name":"Htop Amaika | Adults only","tti_code":"A5144","country":"ES"},
  {"solmar_code":"CALCAL","name":"Htop Jadhe (ex-Calella Palace)","tti_code":"A55074","country":"ES"},
  {"solmar_code":"CALCON","name":"Continental Calella","tti_code":"A5156","country":"ES"},
  {"solmar_code":"CALESP","name":"Espanya","tti_code":"A76284","country":"ES"},
  {"solmar_code":"CALGAR","name":"Checkin Garbi","tti_code":"A5160","country":"ES"},
  {"solmar_code":"CALKAK","name":"Kaktus Playa","tti_code":"A5167","country":"ES"},
  {"solmar_code":"CALMAR","name":"Maritim","tti_code":"A21856","country":"ES"},
  {"solmar_code":"CALMIA","name":"Miami","tti_code":"A5172","country":"ES"},
  {"solmar_code":"CALMIP","name":"Miami Park","tti_code":"A5172","country":"ES"},
  {"solmar_code":"CALNEA","name":"Appartementen Neptuno","tti_code":"A5175","country":"ES"},
  {"solmar_code":"CALNEP","name":"Neptuno Hotel & Spa Calella","tti_code":"A5175","country":"ES"},
  {"solmar_code":"CALOLY","name":"Htop Olympic","tti_code":"A5178","country":"ES"},
  {"solmar_code":"CALSAM","name":"Santa Monica","tti_code":"A5187","country":"ES"},
  {"solmar_code":"CALVOL","name":"Volga","tti_code":"A5197","country":"ES"},
  {"solmar_code":"CAMAUG","name":"Augustus","tti_code":"A4632","country":"ES"},
  {"solmar_code":"CAMCAM","name":"Best Cambrils","tti_code":"A4642","country":"ES"},
  {"solmar_code":"CAMCAP","name":"H10 Cambrils Playa","tti_code":"A4636","country":"ES"},
  {"solmar_code":"CAMCEN","name":"Estival Centurion Playa","tti_code":"A4638","country":"ES"},
  {"solmar_code":"CAMELD","name":"Estival Eldorado Resort","tti_code":"A4657","country":"ES"},
  {"solmar_code":"CAMFPM","name":"Olympus Palace - Henk Bernard Fanreis 2025","tti_code":"A4651","country":"ES"},
  {"solmar_code":"CAMMAR","name":"Best Maritim","tti_code":"A4651","country":"ES"},
  {"solmar_code":"CAMOLI","name":"Olimar II","tti_code":"A21882","country":"ES"},
  {"solmar_code":"CAMPIN","name":"Appartementen Pins Platja","tti_code":"A4645","country":"ES"},
  {"solmar_code":"CAMPOR","name":"Port eugeni","tti_code":"A4655","country":"ES"},
  {"solmar_code":"CAMSOL","name":"Sol port cambrils","tti_code":"A31295","country":"ES"},
  {"solmar_code":"CAMVOR","name":"Voramar","tti_code":"A4664","country":"ES"},
  {"solmar_code":"CANBGJ","name":"BG Java","tti_code":"A10141","country":"ES"},
  {"solmar_code":"CANJSP","name":"JS Palma Stay","tti_code":"A76275","country":"ES"},
  {"solmar_code":"CANLAS","name":"Las Arenas","tti_code":"A10131","country":"ES"},
  {"solmar_code":"CARCUY","name":"THB Guya Playa","tti_code":"A28684","country":"ES"},
  {"solmar_code":"CARGRE","name":"Green Garden","tti_code":"A51155","country":"ES"},
  {"solmar_code":"CARTHB","name":"THB Cala lliteras","tti_code":"A41988","country":"ES"},
  {"solmar_code":"CDMHYB","name":"HYB Eurocalas","tti_code":"A10065","country":"ES"},
  {"solmar_code":"CLFMIR","name":"4R miramar calafell","tti_code":"A31656","country":"ES"},
  {"solmar_code":"CLPBAH","name":"Hotel Bahía Calpe","tti_code":"A81632","country":"ES"},
  {"solmar_code":"CLPDIA","name":"Diamante Beach & Spa","tti_code":"A41209","country":"ES"},
  {"solmar_code":"CLPESM","name":"Hotel Roca Esmeralda & Spa","tti_code":"A4485","country":"ES"},
  {"solmar_code":"CLPESS","name":"Appartementen Esmeralda Suites","tti_code":"A60456","country":"ES"},
  {"solmar_code":"CLPEUR","name":"Aparthotel Port Europa","tti_code":"A76149","country":"ES"},
  {"solmar_code":"CLPIFA","name":"Hotel RH Ifach","tti_code":"A29610","country":"ES"},
  {"solmar_code":"CLPSUI","name":"Hotel Suitopia Sol y Mar Suites","tti_code":"A79110","country":"ES"},
  {"solmar_code":"CLPSYM","name":"Gran Hotel Sol y Mar","tti_code":"A55012","country":"ES"},
  {"solmar_code":"COAVIN","name":"Vincci La Plantacion del Sur","tti_code":"A39597","country":"ES"},
  {"solmar_code":"COMBAL","name":"Balneario playa de comarruga","tti_code":"A93974","country":"ES"},
  {"solmar_code":"COMBRI","name":"Brisamar suites","tti_code":"A82432","country":"ES"},
  {"solmar_code":"COMCOM","name":"Comarruga Platja","tti_code":"A71475","country":"ES"},
  {"solmar_code":"COMGRA","name":"4R Gran europe","tti_code":"A4669","country":"ES"},
  {"solmar_code":"COMVEN","name":"Vendrell Platja","tti_code":"A4672","country":"ES"},
  {"solmar_code":"CORHOS","name":"Hospederia luis de gongora","tti_code":"A93967","country":"ES"},
  {"solmar_code":"CORLAS","name":"Las Casas de la Juderia Cordoba","tti_code":"A65204","country":"ES"},
  {"solmar_code":"CORMAC","name":"Macia alfaros","tti_code":"A47367","country":"ES"},
  {"solmar_code":"CORPAL","name":"H10 Palacio Colomera","tti_code":"A90071","country":"ES"},
  {"solmar_code":"CPFJSH","name":"JS Horitzo","tti_code":"A51151","country":"ES"},
  {"solmar_code":"CPFPAL","name":"Can Picafort Palace","tti_code":"A28522","country":"ES"},
  {"solmar_code":"CPFTHB","name":"THB Gran Bahia","tti_code":"A22411","country":"ES"},
  {"solmar_code":"CPFTRE","name":"Trend Alcudia","tti_code":"A74544","country":"ES"},
  {"solmar_code":"CSJTHB","name":"THB Sur Mallorca","tti_code":"A10101","country":"ES"},
  {"solmar_code":"DENPOR","name":"Port Denia","tti_code":"A4506","country":"ES"},
  {"solmar_code":"ELSPAR","name":"Parador de el saler","tti_code":"A25258","country":"ES"},
  {"solmar_code":"EMPCOM","name":"Appartementen Comte d'Empuries","tti_code":"A5250","country":"ES"},
  {"solmar_code":"EMPPON","name":"Xons platja","tti_code":"A5256","country":"ES"},
  {"solmar_code":"EMPXON","name":"Aparthotel Xons Platja","tti_code":"A5256","country":"ES"},
  {"solmar_code":"ESTFLA","name":"Checkin Flamingo","tti_code":"A5940","country":"ES"},
  {"solmar_code":"FONNAT","name":"Na taconera","tti_code":"A40408","country":"ES"},
  {"solmar_code":"FUECEN","name":"Monarque Cendrillon","tti_code":"A7703","country":"ES"},
  {"solmar_code":"FUEFLO","name":"Florida spa","tti_code":"A7637","country":"ES"},
  {"solmar_code":"FUEHIG","name":"Higueron Curio Collection by Hilton","tti_code":"A72480","country":"ES"},
  {"solmar_code":"FUEIPV","name":"IPV Palace and Spa","tti_code":"A32328","country":"ES"},
  {"solmar_code":"FUEMNR","name":"Monarque Fuengirola Park","tti_code":"A7705","country":"ES"},
  {"solmar_code":"FUEMYR","name":"Myramar Fuengirola","tti_code":"A28492","country":"ES"},
  {"solmar_code":"FUEYAR","name":"Yaramar","tti_code":"A5288","country":"ES"},
  {"solmar_code":"GRAABA","name":"Abades Nevada palace","tti_code":"A83961","country":"ES"},
  {"solmar_code":"GRAALH","name":"Alhambra palace","tti_code":"A47726","country":"ES"},
  {"solmar_code":"GRAGRA","name":"macia granada five senses room and sutes","tti_code":"A59135","country":"ES"},
  {"solmar_code":"GRAMAC","name":"Macia Condor","tti_code":"A83962","country":"ES"},
  {"solmar_code":"GRAMAP","name":"Ma Princesa Ana","tti_code":"A93968","country":"ES"},
  {"solmar_code":"GRAMON","name":"Macia monasterio de los basilios","tti_code":"A47725","country":"ES"},
  {"solmar_code":"GRAPLA","name":"Macia plaza","tti_code":"A73480","country":"ES"},
  {"solmar_code":"GRASAN","name":"Ohtels San Anton","tti_code":"A60476","country":"ES"},
  {"solmar_code":"GRASER","name":"Sercotel Gran hotel luna de granada","tti_code":"A87073","country":"ES"},
  {"solmar_code":"HDIMER","name":"4R Meridia mar","tti_code":"A28919","country":"ES"},
  {"solmar_code":"HDLABB","name":"Abba garden","tti_code":"A59141","country":"ES"},
  {"solmar_code":"HDLEUR","name":"Eurohotel Barcelona granvia fira","tti_code":"A85107","country":"ES"},
  {"solmar_code":"KERSTREIS","name":"Kerstreis Calella","tti_code":"A5167","country":"ES"},
  {"solmar_code":"LASCON","name":"H10 Conquistador","tti_code":"A10835","country":"ES"},
  {"solmar_code":"LASHDP","name":"HD Parque Cristobal Tenerife","tti_code":"A10886","country":"ES"},
  {"solmar_code":"LASVAN","name":"Vanilla Garden","tti_code":"A75740","country":"ES"},
  {"solmar_code":"LLOANA","name":"Anabel","tti_code":"A22193","country":"ES"},
  {"solmar_code":"LLOAUG","name":"Augusta Club Hotel & Spa","tti_code":"A6958","country":"ES"},
  {"solmar_code":"LLOBER","name":"Bertran Park","tti_code":"A6984","country":"ES"},
  {"solmar_code":"LLOCEN","name":"Guitart Central Park Aqua Resort","tti_code":"A7183","country":"ES"},
  {"solmar_code":"LLODEL","name":"Delamar","tti_code":"A7170","country":"ES"},
  {"solmar_code":"LLODON","name":"Don Juan Resort","tti_code":"A7149","country":"ES"},
  {"solmar_code":"LLOFLA","name":"Gran Hotel Flamingo","tti_code":"A7166","country":"ES"},
  {"solmar_code":"LLOGAR","name":"Garbi Park","tti_code":"A7172","country":"ES"},
  {"solmar_code":"LLOGRA","name":"Gran Garbi","tti_code":"A7180","country":"ES"},
  {"solmar_code":"LLOHEL","name":"Helios Lloret","tti_code":"A7197","country":"ES"},
  {"solmar_code":"LLOMET","name":"Metropol","tti_code":"A23188","country":"ES"},
  {"solmar_code":"LLOOAS","name":"Oasis Park Lloret","tti_code":"A7283","country":"ES"},
  {"solmar_code":"LLOOLY","name":"Olympic Resort (Park/Garden/Palace)","tti_code":"A88276","country":"ES"},
  {"solmar_code":"LLOROB","name":"Rosamar Es Blau","tti_code":"A91370","country":"ES"},
  {"solmar_code":"LLOROG","name":"Rosamar Garden","tti_code":"A31560","country":"ES"},
  {"solmar_code":"LLOROS","name":"Rosamar & Spa","tti_code":"A7298","country":"ES"},
  {"solmar_code":"LLOROY","name":"Htop Royal Star","tti_code":"A7199","country":"ES"},
  {"solmar_code":"LLOSAM","name":"Samba","tti_code":"A7309","country":"ES"},
  {"solmar_code":"LLOSAN","name":"Hotel BPM Lloret","tti_code":"A7157","country":"ES"},
  {"solmar_code":"LPDESP","name":"Estival Park Silmar","tti_code":"A4682","country":"ES"},
  {"solmar_code":"LPDEST","name":"Appartementen Estival","tti_code":"A4682","country":"ES"},
  {"solmar_code":"LPDGOC","name":"Golden Costa Salou","tti_code":"A88478","country":"ES"},
  {"solmar_code":"LPDGOD","name":"Golden Donaire Beach","tti_code":"A4681","country":"ES"},
  {"solmar_code":"LPDHAC","name":"Ohtels la Hacienda","tti_code":"A26939","country":"ES"},
  {"solmar_code":"LPDPAD","name":"Pineda park","tti_code":"A75735","country":"ES"},
  {"solmar_code":"LPDPAL","name":"Hotel Palas Pineda","tti_code":"A22138","country":"ES"},
  {"solmar_code":"LPDSOL","name":"Hotel Best Sol D'or","tti_code":"A5076","country":"ES"},
  {"solmar_code":"MADCAT","name":"Catalonia goya","tti_code":"A40892","country":"ES"},
  {"solmar_code":"MADCEN","name":"Vincci centrum","tti_code":"A32126","country":"ES"},
  {"solmar_code":"MADCTN","name":"Catalonia puerta del sol","tti_code":"A32229","country":"ES"},
  {"solmar_code":"MADPRT","name":"H10 Puerta de Alcala","tti_code":"A34716","country":"ES"},
  {"solmar_code":"MADPUE","name":"Puerta de toledo","tti_code":"A32227","country":"ES"},
  {"solmar_code":"MADSEN","name":"Sensator Barajas","tti_code":"A78780","country":"ES"},
  {"solmar_code":"MADSER","name":"Sercotel Madrid aeropuerto","tti_code":"A59416","country":"ES"},
  {"solmar_code":"MADSNT","name":"Sensator castellana","tti_code":"A59552","country":"ES"},
  {"solmar_code":"MADSOH","name":"Vincci Soho","tti_code":"A40867","country":"ES"},
  {"solmar_code":"MADSOM","name":"Vincci Soma","tti_code":"A32230","country":"ES"},
  {"solmar_code":"MADVIA","name":"Vincci via 66","tti_code":"A47440","country":"ES"},
  {"solmar_code":"MADVIN","name":"Vincci Capitol","tti_code":"A43752","country":"ES"},
  {"solmar_code":"MALALH","name":"Hotel Alhambra","tti_code":"A5230","country":"ES"},
  {"solmar_code":"MALAMA","name":"Amaraigua","tti_code":"A31291","country":"ES"},
  {"solmar_code":"MALAQU","name":"Aquamarina & spa","tti_code":"A5231","country":"ES"},
  {"solmar_code":"MALATZ","name":"Atzavara","tti_code":"A93771","country":"ES"},
  {"solmar_code":"MALCAP","name":"Alegria Caprici Verd","tti_code":"A26930","country":"ES"},
  {"solmar_code":"MALFLO","name":"Alegria Florida Park","tti_code":"A5235","country":"ES"},
  {"solmar_code":"MALHTO","name":"Htop Planamar","tti_code":"A5206","country":"ES"},
  {"solmar_code":"MALIND","name":"Indalo Park","tti_code":"A5237","country":"ES"},
  {"solmar_code":"MALLUC","name":"Luna Club","tti_code":"A24646","country":"ES"},
  {"solmar_code":"MALLUP","name":"Luna Park","tti_code":"A79951","country":"ES"},
  {"solmar_code":"MALMAR","name":"Del Mar","tti_code":"A27254","country":"ES"},
  {"solmar_code":"MALMMD","name":"Alegria Mar Mediterrania","tti_code":"A5238","country":"ES"},
  {"solmar_code":"MALMON","name":"Sumus Monteplaya & Spa","tti_code":"A29778","country":"ES"},
  {"solmar_code":"MALMOS","name":"Aquahotel The Breeze (ex-Montagut)","tti_code":"A5241","country":"ES"},
  {"solmar_code":"MALMRP","name":"Alegria Maripins","tti_code":"A5203","country":"ES"},
  {"solmar_code":"MALMTM","name":"Montemar Maritim","tti_code":"A28947","country":"ES"},
  {"solmar_code":"MALODI","name":"Odissea Park","tti_code":"A44405","country":"ES"},
  {"solmar_code":"MALONA","name":"Onabrava & Spa","tti_code":"A8488","country":"ES"},
  {"solmar_code":"MALPAP","name":"Papi / Papi Blau","tti_code":"A5204","country":"ES"},
  {"solmar_code":"MALRIV","name":"Riviera","tti_code":"A5243","country":"ES"},
  {"solmar_code":"MALRNA","name":"Rosa Nautica","tti_code":"A5211","country":"ES"},
  {"solmar_code":"MALROY","name":"Htop Royal Sun","tti_code":"A5244","country":"ES"},
  {"solmar_code":"MALRSS","name":"Htop Royal Sun Suites","tti_code":"A43857","country":"ES"},
  {"solmar_code":"MALSIL","name":"Silhouette & Spa","tti_code":"A5200","country":"ES"},
  {"solmar_code":"MALSIR","name":"DWO Sirius","tti_code":"A23467","country":"ES"},
  {"solmar_code":"MALSOR","name":"Sorra Daurada & Splash","tti_code":"A5212","country":"ES"},
  {"solmar_code":"MALTAH","name":"Tahiti Playa & Suites","tti_code":"A5246","country":"ES"},
  {"solmar_code":"MALTRO","name":"Tropic Park","tti_code":"A5215","country":"ES"},
  {"solmar_code":"MARBLU","name":"Bluebay Banus","tti_code":"A8199","country":"ES"},
  {"solmar_code":"MARGUA","name":"Guadalmina spa and golf resort","tti_code":"A8205","country":"ES"},
  {"solmar_code":"MARVIN","name":"Vincci Seleccion Estrella del Mar","tti_code":"A7793","country":"ES"},
  {"solmar_code":"MGLSAM","name":"Samos","tti_code":"A10307","country":"ES"},
  {"solmar_code":"MIATOR","name":"La Torre del Sol","tti_code":"A4694","country":"ES"},
  {"solmar_code":"MIATRO","name":"Tropikana","tti_code":"A93972","country":"ES"},
  {"solmar_code":"MIJVIK","name":"VIK Gran Hotel Costa del Sol","tti_code":"A30082","country":"ES"},
  {"solmar_code":"MLGBOU","name":"Boutique atarazanas","tti_code":"A53795","country":"ES"},
  {"solmar_code":"MLGMAL","name":"Vincci Malaga","tti_code":"A60496","country":"ES"},
  {"solmar_code":"MLGMSM","name":"MS Maestranza","tti_code":"A46116","country":"ES"},
  {"solmar_code":"MLGSEL","name":"Vincci selecion posasa del patio","tti_code":"A71904","country":"ES"},
  {"solmar_code":"OLINOV","name":"Oliva nova golf","tti_code":"A4605","country":"ES"},
  {"solmar_code":"ORGPUE","name":"Puerta Nazari","tti_code":"A93970","country":"ES"},
  {"solmar_code":"ORODOR","name":"Marina Dor 5 estrellas balneario","tti_code":"A93965","country":"ES"},
  {"solmar_code":"OROMAR","name":"Marina dor gran duque","tti_code":"A8682","country":"ES"},
  {"solmar_code":"ORRPLA","name":"Playa Park Zensation","tti_code":"A8932","country":"ES"},
  {"solmar_code":"PAGMAR","name":"Mar Hotels Paguera and Spa","tti_code":"A8522","country":"ES"},
  {"solmar_code":"PATTAC","name":"Tactica","tti_code":"A93973","country":"ES"},
  {"solmar_code":"PATVAL","name":"Valencia congress","tti_code":"A93966","country":"ES"},
  {"solmar_code":"PDAMON","name":"Monterrey","tti_code":"A7380","country":"ES"},
  {"solmar_code":"PDLBLU","name":"Blue Sea Interpalace","tti_code":"A10965","country":"ES"},
  {"solmar_code":"PDMBGR","name":"BG Rei del Mediterrani Palace","tti_code":"A10336","country":"ES"},
  {"solmar_code":"PDMGAR","name":"Garden Holiday Village","tti_code":"A38676","country":"ES"},
  {"solmar_code":"PDMMAR","name":"Mar Hotels Playa de Muro Suites","tti_code":"A41186","country":"ES"},
  {"solmar_code":"PDMVIV","name":"Viva Blue and Spa","tti_code":"A31164","country":"ES"},
  {"solmar_code":"PDPBGP","name":"BG Pamplona","tti_code":"A48255","country":"ES"},
  {"solmar_code":"PDPGAR","name":"Paradiso Garden","tti_code":"A27242","country":"ES"},
  {"solmar_code":"PENACL","name":"Aparthotel Acualandia","tti_code":"A8683","country":"ES"},
  {"solmar_code":"PENACU","name":"Aparthotel Acuazul","tti_code":"A8707","country":"ES"},
  {"solmar_code":"PENACZ","name":"Hotel Acuazul","tti_code":"A8707","country":"ES"},
  {"solmar_code":"PENARE","name":"Arena Prado","tti_code":"A28949","country":"ES"},
  {"solmar_code":"PENCAS","name":"Hotel & Spa Castillo de Peñiscola","tti_code":"A8739","country":"ES"},
  {"solmar_code":"PENDON","name":"Hotel Don Carlos","tti_code":"A61951","country":"ES"},
  {"solmar_code":"PENPAL","name":"Hotel Peñíscola Palace","tti_code":"A8741","country":"ES"},
  {"solmar_code":"PENPAP","name":"Hotel Papa Luna","tti_code":"A8740","country":"ES"},
  {"solmar_code":"PENPEN","name":"Gran Hotel Peñíscola","tti_code":"A27378","country":"ES"},
  {"solmar_code":"PENPLA","name":"Hotel Peñíscola Plaza","tti_code":"A28948","country":"ES"},
  {"solmar_code":"PENPRA","name":"Prado II","tti_code":"A28949","country":"ES"},
  {"solmar_code":"PINMER","name":"Merce","tti_code":"A5220","country":"ES"},
  {"solmar_code":"PINPIN","name":"Fergus Club Pineda Splash","tti_code":"A5221","country":"ES"},
  {"solmar_code":"PINPIN COMB","name":"Combinatiereis Pineda Splash","tti_code":"A5221","country":"ES"},
  {"solmar_code":"PINPRO","name":"Promenade","tti_code":"A5224","country":"ES"},
  {"solmar_code":"PINSBA","name":"Appartementen Sorrabona","tti_code":"A5225","country":"ES"},
  {"solmar_code":"PINSOR","name":"Sorrabona","tti_code":"A5226","country":"ES"},
  {"solmar_code":"PINSTE","name":"Sumus Stella & Spa","tti_code":"A5227","country":"ES"},
  {"solmar_code":"PINTAU","name":"Golden Taurus Aquapark Resort","tti_code":"A5228","country":"ES"},
  {"solmar_code":"PLACAL","name":"Htop Caleta Palace","tti_code":"A7367","country":"ES"},
  {"solmar_code":"PLAGOE","name":"Goetten","tti_code":"A93975","country":"ES"},
  {"solmar_code":"PLAPLA","name":"Planamar","tti_code":"A7427","country":"ES"},
  {"solmar_code":"PLAPLP","name":"Htop Platja Park","tti_code":"A7375","country":"ES"},
  {"solmar_code":"PMIZUR","name":"Zurbaran","tti_code":"A59271","country":"ES"},
  {"solmar_code":"PMNMAR_O","name":"Marsenses Rosa Del Mar","tti_code":"A10428","country":"ES"},
  {"solmar_code":"PMNSOL","name":"Aquasol","tti_code":"A10406","country":"ES"},
  {"solmar_code":"PORJSC","name":"JS Cape Colom","tti_code":"A48422","country":"ES"},
  {"solmar_code":"PORJSP","name":"JS Portocolom Suites","tti_code":"A29095","country":"ES"},
  {"solmar_code":"ROSMAR","name":"Prestige Sant Marc","tti_code":"A7488","country":"ES"},
  {"solmar_code":"ROSPAR","name":"Hotel Mediterraneo Park","tti_code":"A25270","country":"ES"},
  {"solmar_code":"ROSPLA","name":"Hotel Prestige Coral Platja","tti_code":"A7466","country":"ES"},
  {"solmar_code":"ROSUNI","name":"Hotel Univers","tti_code":"A7495","country":"ES"},
  {"solmar_code":"ROSVIC","name":"Prestige Victoria","tti_code":"A7496","country":"ES"},
  {"solmar_code":"ROSXON","name":"Xon's Platja hotel","tti_code":"A5256","country":"ES"},
  {"solmar_code":"SACEUR","name":"Eurocamping","tti_code":"A7503","country":"ES"},
  {"solmar_code":"SAGSAG","name":"S'Agaro Mar","tti_code":"A23285","country":"ES"},
  {"solmar_code":"SALACQ","name":"Acqua","tti_code":"A4749","country":"ES"},
  {"solmar_code":"SALAPT","name":"Aptos Cye salou","tti_code":"A4755","country":"ES"},
  {"solmar_code":"SALBEL","name":"Ohtels Belvedere","tti_code":"A4719","country":"ES"},
  {"solmar_code":"SALBLA","name":"Best Los Angeles","tti_code":"A4789","country":"ES"},
  {"solmar_code":"SALBLM","name":"Blaumar Salou","tti_code":"A4742","country":"ES"},
  {"solmar_code":"SALBSD","name":"Best San Diego","tti_code":"A5070","country":"ES"},
  {"solmar_code":"SALCAG","name":"California Garden","tti_code":"A4744","country":"ES"},
  {"solmar_code":"SALCAL","name":"California app","tti_code":"A38222","country":"ES"},
  {"solmar_code":"SALCAP","name":"California Palace","tti_code":"A43306","country":"ES"},
  {"solmar_code":"SALCAR","name":"Caribe","tti_code":"A29711","country":"ES"},
  {"solmar_code":"SALCAS","name":"Best Cap Salou","tti_code":"A4747","country":"ES"},
  {"solmar_code":"SALCFT","name":"Cala Font","tti_code":"A4743","country":"ES"},
  {"solmar_code":"SALCLY","name":"Calypso","tti_code":"A4745","country":"ES"},
  {"solmar_code":"SALCYE","name":"Cye holiday centre","tti_code":"A61791","country":"ES"},
  {"solmar_code":"SALDAV","name":"Best Da Vinci Royal","tti_code":"A4758","country":"ES"},
  {"solmar_code":"SALDEL","name":"H10 Delfin","tti_code":"A4759","country":"ES"},
  {"solmar_code":"SALDOR","name":"Ponient Dorada Palace","tti_code":"A41366","country":"ES"},
  {"solmar_code":"SALELP","name":"Hotel El Paso","tti_code":"A27115","country":"ES"},
  {"solmar_code":"SALEUR","name":"EuroSalou & Spa","tti_code":"A4763","country":"ES"},
  {"solmar_code":"SALGOL","name":"Golden avenida suites","tti_code":"A4716","country":"ES"},
  {"solmar_code":"SALGOP","name":"Golden Port Salou & Spa","tti_code":"A5018","country":"ES"},
  {"solmar_code":"SALGOR","name":"Gold River","tti_code":"A61881","country":"ES"},
  {"solmar_code":"SALJAI","name":"Hotel Jaime I","tti_code":"A4781","country":"ES"},
  {"solmar_code":"SALLAV","name":"Las Vegas","tti_code":"A4787","country":"ES"},
  {"solmar_code":"SALLOS","name":"Los peces","tti_code":"A4795","country":"ES"},
  {"solmar_code":"SALMAG","name":"Magnolia salou","tti_code":"A39081","country":"ES"},
  {"solmar_code":"SALMAR","name":"Marinda","tti_code":"A4796","country":"ES"},
  {"solmar_code":"SALMED","name":"H10 Mediterranean Village","tti_code":"A61193","country":"ES"},
  {"solmar_code":"SALNEG","name":"Best Negresco","tti_code":"A4811","country":"ES"},
  {"solmar_code":"SALOAS","name":"Best Oasis Park Salou","tti_code":"A4813","country":"ES"},
  {"solmar_code":"SALOLY","name":"Olympus Palace","tti_code":"A4815","country":"ES"},
  {"solmar_code":"SALPLA","name":"Appartementen Salou Playa","tti_code":"A93962","country":"ES"},
  {"solmar_code":"SALPLO","name":"Salou Sunset (voorheen Playa de Oro)","tti_code":"A4983","country":"ES"},
  {"solmar_code":"SALPLP","name":"Playa Park","tti_code":"A5016","country":"ES"},
  {"solmar_code":"SALPOA","name":"Port Aventura","tti_code":"A27114","country":"ES"},
  {"solmar_code":"SALPR1","name":"Salou Park Resort I","tti_code":"A23286","country":"ES"},
  {"solmar_code":"SALPR2","name":"Salou Park Resort II","tti_code":"A4991","country":"ES"},
  {"solmar_code":"SALPRN","name":"H10 Salou Princess","tti_code":"A5074","country":"ES"},
  {"solmar_code":"SALREG","name":"Gran Hotel Regina","tti_code":"A23463","country":"ES"},
  {"solmar_code":"SALSAP","name":"H10 Salauris Palace","tti_code":"A21883","country":"ES"},
  {"solmar_code":"SALSOL","name":"Sol costa duarada","tti_code":"A29847","country":"ES"},
  {"solmar_code":"SALVID","name":"Ohtels Villa Dorada","tti_code":"A5078","country":"ES"},
  {"solmar_code":"SALVIN","name":"H10 Vintage Salou","tti_code":"A4762","country":"ES"},
  {"solmar_code":"SALVIR","name":"Ohtels Vil La Romana","tti_code":"A27481","country":"ES"},
  {"solmar_code":"SANLAR","name":"La Rapita","tti_code":"A31664","country":"ES"},
  {"solmar_code":"SAOMED","name":"Hipotels Mediterraneo club","tti_code":"A10540","country":"ES"},
  {"solmar_code":"SAOTHB","name":"THB Sa Coma Platja","tti_code":"A10541","country":"ES"},
  {"solmar_code":"SEVCAS","name":"H10 Casa de la Plata","tti_code":"A30038","country":"ES"},
  {"solmar_code":"SEVCAT","name":"Catalonia giralda","tti_code":"A38599","country":"ES"},
  {"solmar_code":"SEVCOR","name":"H10 Corregidor Boutique","tti_code":"A39537","country":"ES"},
  {"solmar_code":"SEVHIS","name":"Catalonia hispalis","tti_code":"A33549","country":"ES"},
  {"solmar_code":"SEVLAS","name":"Las casas de la juderia sevilla","tti_code":"A32793","country":"ES"},
  {"solmar_code":"SEVMAC","name":"Macia sevilla kubb","tti_code":"A32855","country":"ES"},
  {"solmar_code":"SEVMAS","name":"Ma Sevilla Congresos","tti_code":"A87605","country":"ES"},
  {"solmar_code":"SEVPAS","name":"Pasarela","tti_code":"A83977","country":"ES"},
  {"solmar_code":"SEVRIB","name":"Ribera de triana","tti_code":"A32861","country":"ES"},
  {"solmar_code":"SEVSAN","name":"San Gil","tti_code":"A32311","country":"ES"},
  {"solmar_code":"SEVVIN","name":"Vincci la Rabida","tti_code":"A34965","country":"ES"},
  {"solmar_code":"SFGBAR","name":"Barcarola","tti_code":"A31653","country":"ES"},
  {"solmar_code":"SJUPOR","name":"Port Alicante","tti_code":"A85973","country":"ES"},
  {"solmar_code":"TARTOR","name":"Torre de la Mora","tti_code":"A31311","country":"ES"},
  {"solmar_code":"TORBAR","name":"La Barracuda","tti_code":"A8271","country":"ES"},
  {"solmar_code":"TORCAR","name":"Mediterráneo Carihuela","tti_code":"A22321","country":"ES"},
  {"solmar_code":"TORCER","name":"Blue Sea Gran Cervantes","tti_code":"A8238","country":"ES"},
  {"solmar_code":"TORECA","name":"Ecuador park","tti_code":"A8254","country":"ES"},
  {"solmar_code":"TORFEN","name":"Fenix Torremolinos","tti_code":"A8264","country":"ES"},
  {"solmar_code":"TORMED","name":"Hotel Med Playa Pez Espada","tti_code":"A8301","country":"ES"},
  {"solmar_code":"TORPAR","name":"Parasol Garden","tti_code":"A8297","country":"ES"},
  {"solmar_code":"TORPEZ","name":"Pez Espada","tti_code":"A8301","country":"ES"},
  {"solmar_code":"TORPUE","name":"Puente Real","tti_code":"A8307","country":"ES"},
  {"solmar_code":"TORROC","name":"Hotel Roc Lago Rojo","tti_code":"A8324","country":"ES"},
  {"solmar_code":"TORROY","name":"Royal Al-andalus","tti_code":"A8210","country":"ES"},
  {"solmar_code":"TOSCON","name":"Continental Tossa","tti_code":"A7526","country":"ES"},
  {"solmar_code":"TOSCOS","name":"Costa Brava","tti_code":"A7525","country":"ES"},
  {"solmar_code":"TOSESM","name":"Aparthotel Esmeraldas","tti_code":"A7533","country":"ES"},
  {"solmar_code":"TOSGIV","name":"Pola Giverola","tti_code":"A31744","country":"ES"},
  {"solmar_code":"TOSGOL","name":"Golden Bahía de Tossa & Spa","tti_code":"A28944","country":"ES"},
  {"solmar_code":"TOSNEP","name":"Neptuno Tossa","tti_code":"A7543","country":"ES"},
  {"solmar_code":"TOSOAS","name":"Oasis Tossa & Spa","tti_code":"A7545","country":"ES"},
  {"solmar_code":"TOSTOS","name":"Tossa Beach Center","tti_code":"A7562","country":"ES"},
  {"solmar_code":"Tropic comb","name":"Bus/vlieg Tropic Park","tti_code":"A5215","country":"ES"},
  {"solmar_code":"VALCAT","name":"Catalonia excelsior","tti_code":"A35587","country":"ES"},
  {"solmar_code":"VALLYS","name":"Vincci Lys","tti_code":"A32324","country":"ES"},
  {"solmar_code":"VALMER","name":"Vincci Mercat","tti_code":"A80079","country":"ES"},
  {"solmar_code":"VALPAL","name":"Vincci Palace","tti_code":"A43561","country":"ES"},
  {"solmar_code":"VALSEN","name":"Senator parque central","tti_code":"A39200","country":"ES"},
  {"solmar_code":"VALSHI","name":"SH Ingles","tti_code":"A39349","country":"ES"},
  {"solmar_code":"VILALL","name":"Allon mediterrania","tti_code":"A69007","country":"ES"},
  {"solmar_code":"VILVIL","name":"Vilanova Park","tti_code":"A5108","country":"ES"},
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function ttiFetch(path) {
  const res = await fetch(`${TTI_BASE}${path}`, {
    headers: { 
      'Authorization': `ApiKey ${TTI_API_KEY}`,
      'Accept': 'application/json',
      'Accept-Language': 'nl',
      'User-Agent': 'TTP-Dashboard/1.0'
    }
  });
  if (!res.ok) {
    const errText = await res.text().catch(()=>'');
    throw new Error(`TTI ${res.status}: ${path} | ${errText.substring(0,200)}`);
  }
  return res.json();
}

// ─── ENSURE TABLES EXIST ──────────────────────────────────────────────────────
async function ensureTables(pool) {
  await pool.request().query(`IF OBJECT_ID('HotelReviews','U') IS NOT NULL ALTER TABLE HotelReviews ALTER COLUMN overall_rating INT`);
  await pool.request().query(`IF OBJECT_ID('HotelRatings','U') IS NOT NULL ALTER TABLE HotelRatings ALTER COLUMN avg_overall INT`);
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='HotelRatings' AND xtype='U')
    CREATE TABLE HotelRatings (
      id INT IDENTITY(1,1) PRIMARY KEY,
      accommodation_code VARCHAR(20),
      accommodation_name NVARCHAR(200),
      external_code VARCHAR(20),
      avg_overall INT, avg_sleep INT, avg_location INT,
      avg_cleanliness INT, avg_service INT, avg_facilities INT,
      total_reviews INT, recommendation_pct INT,
      snapshot_date DATE,
      created_at DATETIME DEFAULT GETDATE()
    )`);

  // Drop and recreate HotelReviews with safe INT column types for TTI scores (0-100)
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='HotelReviews' AND xtype='U')
    CREATE TABLE HotelReviews (
      id INT IDENTITY(1,1) PRIMARY KEY,
      accommodation_code VARCHAR(20),
      accommodation_name NVARCHAR(200),
      tti_review_id VARCHAR(100),
      review_date DATE,
      overall_rating INT,
      category_sleep INT, category_location INT,
      category_cleanliness INT, category_service INT, category_facilities INT,
      review_title NVARCHAR(500),
      review_text NVARCHAR(MAX),
      reviewer_name NVARCHAR(200),
      reviewer_city NVARCHAR(100),
      reviewer_country VARCHAR(10),
      reviewer_age VARCHAR(20),
      travel_type NVARCHAR(100),
      language VARCHAR(10),
      created_at DATETIME DEFAULT GETDATE()
    )`);
  console.log('✅ Tables verified');
}

// ─── LOAD ONE HOTEL ───────────────────────────────────────────────────────────
async function loadHotel(pool, hotel) {
  try {
    const data = await ttiFetch(`/consumer/reviews/accommodation/${hotel.tti_code}`);
    if (!data) return { reviews: 0, ratings: 0 };

    // DEBUG: log first hotel response to understand structure
    if (hotel.tti_code === 'A4430') {
      console.log('\n🔍 DEBUG TTI Response for A4430:');
      console.log('Keys:', Object.keys(data));
      console.log('Sample:', JSON.stringify(data).substring(0, 500));
      console.log('');
    }

    // Actual TTI API field mapping (confirmed from API response)
    const mainRating  = data.mainRating || null;
    const reviewCount = data.reviewCount || 0;
    const recPct      = data.recommendationPercentage || null;
    const answerAvgs  = data.answerAverages || [];
    const reviews     = data.reviews || [];
    const today       = new Date().toISOString().split('T')[0];

    // Extract category averages
    const getAvg = code => { const f=answerAvgs.find(a=>a.code===code); return f?f.average:null; };
    const avg_location   = getAvg('LOCATION');
    const avg_hygiene    = getAvg('HYGIENE');
    const avg_service    = getAvg('SERVICE');
    const avg_facilities = getAvg('FACILITIES');
    const avg_sleep      = getAvg('SLEEP');

    // Upsert ratings
    await pool.request()
      .input('code',  sql.VarChar,   hotel.solmar_code)
      .input('name',  sql.NVarChar,  hotel.name)
      .input('ext',   sql.VarChar,   hotel.tti_code)
      .input('ovr',   sql.Int, mainRating    ? Math.min(100,Math.round(mainRating))    : null)
      .input('slp',   sql.Int, avg_sleep     ? Math.min(100,Math.round(avg_sleep))     : null)
      .input('loc',   sql.Int, avg_location  ? Math.min(100,Math.round(avg_location))  : null)
      .input('cln',   sql.Int, avg_hygiene   ? Math.min(100,Math.round(avg_hygiene))   : null)
      .input('svc',   sql.Int, avg_service   ? Math.min(100,Math.round(avg_service))   : null)
      .input('fac',   sql.Int, avg_facilities? Math.min(100,Math.round(avg_facilities)): null)
      .input('tot',   sql.Int,       reviewCount)
      .input('rec',   sql.Int, recPct ? Math.min(100,Math.round(recPct)) : null)
      .input('date',  sql.Date,      today)
      .query(`
        MERGE HotelRatings AS t
        USING (SELECT @code AS c, @date AS d) AS s ON t.accommodation_code=s.c AND t.snapshot_date=s.d
        WHEN MATCHED THEN UPDATE SET
          avg_overall=@ovr, avg_sleep=@slp, avg_location=@loc,
          avg_cleanliness=@cln, avg_service=@svc, avg_facilities=@fac,
          total_reviews=@tot, recommendation_pct=@rec
        WHEN NOT MATCHED THEN INSERT
          (accommodation_code,accommodation_name,external_code,avg_overall,avg_sleep,
           avg_location,avg_cleanliness,avg_service,avg_facilities,
           total_reviews,recommendation_pct,snapshot_date)
        VALUES (@code,@name,@ext,@ovr,@slp,@loc,@cln,@svc,@fac,@tot,@rec,@date);`);

    // Insert reviews (skip duplicates)
    let newReviews = 0;
    for (const rev of reviews) {
      try {
        const revId = String(rev.id || rev.reviewId || '');
        if (!revId) continue;

        // Check duplicate
        const exists = await pool.request()
          .input('rid', sql.VarChar, revId)
          .query('SELECT 1 FROM HotelReviews WHERE tti_review_id=@rid');
        if (exists.recordset.length) continue;

        // Parse YYYYMMDD date format from TTI
        const rawDate = rev.reviewDate ? String(rev.reviewDate) : null;
        const parsedDate = rawDate && rawDate.length===8
          ? `${rawDate.substring(0,4)}-${rawDate.substring(4,6)}-${rawDate.substring(6,8)}`
          : null;

        // Extract from answers array using correct TTI field names
        const answers = rev.answers || rev.originalAnswers || [];
        const getAnsNum = code => { const f=answers.find(a=>a.code===code); return f?.valueNumber??null; };
        const getAnsStr = code => { const f=answers.find(a=>a.code===code); return f?.valueString??null; };

        const overallRating = getAnsNum('MAIN_RATING');
        const reviewTitle   = getAnsStr('REVIEW_TITLE');
        const reviewText    = getAnsStr('REVIEW_TEXT');

        // Client info
        const client = rev.client || {};

        await pool.request()
          .input('code',    sql.VarChar,   hotel.solmar_code)
          .input('name',    sql.NVarChar,  hotel.name)
          .input('rid',     sql.VarChar,   revId)
          .input('rdate',   sql.Date,      parsedDate)
          .input('ovr',     sql.Int, overallRating != null ? Math.min(100,Math.round(overallRating)) : null)
          .input('slp',     sql.Int, getAnsNum('SLEEP')      != null ? Math.min(100,Math.round(getAnsNum('SLEEP')))      : null)
          .input('loc',     sql.Int, getAnsNum('LOCATION')   != null ? Math.min(100,Math.round(getAnsNum('LOCATION')))   : null)
          .input('cln',     sql.Int, getAnsNum('HYGIENE')    != null ? Math.min(100,Math.round(getAnsNum('HYGIENE')))    : null)
          .input('svc',     sql.Int, getAnsNum('SERVICE')    != null ? Math.min(100,Math.round(getAnsNum('SERVICE')))    : null)
          .input('fac',     sql.Int, getAnsNum('FACILITIES') != null ? Math.min(100,Math.round(getAnsNum('FACILITIES'))) : null)
          .input('title',   sql.NVarChar,  reviewTitle)
          .input('txt',     sql.NVarChar,  reviewText)
          .input('rname',   sql.NVarChar,  client.name || 'Anonymous')
          .input('rcity',   sql.NVarChar,  client.city || null)
          .input('rcnt',    sql.VarChar,   client.country || null)
          .input('rage',    sql.VarChar,   client.age != null ? String(client.age) : null)
          .input('ttype',   sql.NVarChar,  rev.tripOrganizer?.company || null)
          .input('lang',    sql.VarChar,   rev.reviewLanguage || rev.originalLanguage || null)
          .query(`INSERT INTO HotelReviews
            (accommodation_code,accommodation_name,tti_review_id,review_date,
             overall_rating,category_sleep,category_location,category_cleanliness,
             category_service,category_facilities,review_title,review_text,
             reviewer_name,reviewer_city,reviewer_country,reviewer_age,travel_type,language)
            VALUES (@code,@name,@rid,@rdate,@ovr,@slp,@loc,@cln,@svc,@fac,
                    @title,@txt,@rname,@rcity,@rcnt,@rage,@ttype,@lang)`);
        newReviews++;
      } catch(e) {
        // Skip individual review errors
      }
    }
    return { reviews: newReviews, ratings: 1 };
  } catch(e) {
    if (e.message.includes('404')) return { reviews: 0, ratings: 0, skip: true };
    console.warn(`  ⚠ ${hotel.solmar_code} (${hotel.tti_code}): ${e.message}`);
    return { reviews: 0, ratings: 0 };
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 TravelTrustIt Hotel Reviews ETL');
  console.log(`📋 Processing ${HOTELS.length} hotels...`);

  const pool = await sql.connect(dbConfig);
  await ensureTables(pool);

  let totalReviews = 0, totalRatings = 0, skipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < HOTELS.length; i++) {
    const hotel = HOTELS[i];
    const result = await loadHotel(pool, hotel);

    if (result.skip) {
      skipped++;
    } else {
      totalReviews += result.reviews;
      totalRatings += result.ratings;
      if (result.reviews > 0 || result.ratings > 0) {
        console.log(`  [${i+1}/${HOTELS.length}] ✅ ${hotel.name}: ${result.reviews} new reviews`);
      }
    }

    // Progress every 50 hotels
    if ((i+1) % 50 === 0) {
      const elapsed = Math.round((Date.now()-startTime)/1000);
      console.log(`\n📊 Progress: ${i+1}/${HOTELS.length} hotels | ${totalReviews} reviews | ${elapsed}s elapsed\n`);
    }

    await sleep(DELAY_MS);
  }

  const elapsed = Math.round((Date.now()-startTime)/1000);
  console.log('\n✅ ETL Complete!');
  console.log(`   Hotels processed: ${HOTELS.length - skipped}`);
  console.log(`   Hotels skipped (no TTI data): ${skipped}`);
  console.log(`   New reviews loaded: ${totalReviews}`);
  console.log(`   Rating snapshots: ${totalRatings}`);
  console.log(`   Time: ${elapsed}s`);

  await pool.close();
}

main().catch(err => {
  console.error('❌ ETL Error:', err.message);
  process.exit(1);
});
