// Do-not-contact (from sharma-outreach/do-not-contact.csv + standing exclusions).
// Never invent phones, websites, or builders. Hide DNC. Split production vs custom.

const DNC_SUBSTR = [
  "michael alan",
  "michaelalan",
  "iron shield",
  "lenhart electric",
  "truemark",
  "martins",
  "tampa shell",
  "del nero",
  "delnero",
  "danto",
  "dala",
];

// "adc" is too short for a substring match — use a word boundary.
// SAKC / S.A. Casey: skip per Bob Myers (2026-11-11, confirmed by Sanjay) —
// moved here from LOW_PRIORITY so these builders are hidden, not just flagged.
const DNC_WORD = [/\badc\b/i, /\bsakc\b/i, /s\.?\s*a\.?\s*casey/i, /sa casey/i];

const PRODUCTION = [
  "lennar",
  "d.r. horton",
  "dr horton",
  "d r horton",
  "drhorton",
  "pulte",
  "pulte home",
  "pulte group",
  "pultehomes",
  "meritage",
  "kb home",
  "kb homes",
  "taylor morrison",
  "taylormorrison",
  "centex",
  "ryan homes",
  "beazer",
  "toll brothers",
  "toll bros",
  "tollbros",
  "toll brothers",
  "toll bros",
  "tollbros",
  "landsea",
  "hanover family",
  "mattamy",
  "kolter",
  "highland homes",
  "m/i homes",
  "mi homes",
  "m i homes",
  "david weekley",
  "weekley homes",
  "holiday builders",
  "holiday build",
  "maronda",
  "dream finders",
  "dreamfinders",
  "av homes",
  "calatlantic",
  "ryland homes",
  "standard pacific",
  "neal communities",
  "gl homes",
  "stock development",
  "wci communities",
  "wci homes",
  "homes by westbay",
  "ashton woods",
  "lgi homes",
  "drees homes",
  "the drees company",
  "adams homes",
  "ici homes",
  "homes by towne",
  "century complete",
  "century communities",
  "drb group",
  "american heritage homes",
];

const LOW_PRIORITY = [];

// Verified public enrichment (2026-11-11): phone/website confirmed on the
// company's own site, a Google Business listing, BBB, or an official permit
// record. Applied in aggregate() only when the permit data itself is blank.
// Never guess — companies without a verifiable public value stay blank.
const ENRICHMENT = {
  "mattamy-orlando-comp": { phone: "(407) 890-7463", website: "https://mattamyhomes.com/florida/orlando" },
  "home-energy-group-arcxis": { phone: "(855) 500-3747", website: "https://arcxis.com" },
  "ici-homes-of-tampa": { phone: "(855) 215-2974", website: "https://icihomes.com" },
  "ckf-construction-services": { phone: "(904) 517-5939", website: "", contactName: "Chris Funk", contactTitle: "Registered Agent / Financial Responsible Officer", sources: {"phone": "https://aca-prod.accela.com/LEECO/cap/CapDetail.aspx?type=1000&Module=Permitting&capID1&ALTID=RES2022-09422", "contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=5675461"} },
  "luih-luxury-homes": { phone: "(689) 243-9699", website: "https://luih.com/" },
  "capstone-building": { phone: "(205) 803-5226", website: "https://capstonebuilding.com/" },
  "triple-crown-homes": { phone: "(352) 671-4677", website: "http://www.triplecrownhomes.com/" },
  "pulte-home": { phone: "", website: "https://www.pulte.com/" },
  "lennar-homes": { phone: "(305) 559-1951", website: "https://www.lennar.com" },
  "toll-bros": { phone: "", website: "https://www.tollbrothers.com" },
  "dream-finders-homes": { phone: "", website: "https://dreamfindershomes.com" },
  "weekley-homes": { phone: "", website: "https://www.davidweekleyhomes.com/" },
  "weekley-homes-dba-david-weekly": { phone: "", website: "https://www.davidweekleyhomes.com/" },
  "mrcela-custom-homes": { phone: "", website: "https://www.mrcela.com/" },
  // Contact enrichment 2026-11-11 (153 in-territory builders researched in 10 parallel batches;
  // verified public sources only, source URL per field in `sources`; blanks = nothing verified)
  "3cm-construction-ii": {"contactName": "Thomas L. Cavanaugh", "contactTitle": "Manager (Sunbiz annual report signatory) / Registered Agent", "sources": {"contact": "https://static.bizprofile.net/6/9/5/4/2/1/69542172.pdf"}},
  "agosto-builders": {"contactName": "Anthony F. Agosto", "contactTitle": "Certified Building Contractor (licensee, CBC1262144)", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=7BAAB1FDBD43AEF3B27C4ABCC6A7F6B6"}},
  "akers-custom-homes": {"phone": "(407) 352-6700", "website": "http://akerscustomhomesfl.com/", "contactName": "Jim Akers", "contactTitle": "Founder / President", "sources": {"contact": "http://akerscustomhomesfl.com/", "phone": "http://akerscustomhomesfl.com/", "website": "http://akerscustomhomesfl.com/"}},
  "albert-cichra-builders": {"phone": "(407) 275-8954", "website": "albertcichrabuilders.com", "sources": {"phone": "https://prodenv.dep.state.fl.us/DepStaging/api/dms/23.177576.1", "website": "https://prodenv.dep.state.fl.us/DepStaging/api/dms/23.177576.1"}},
  "alfer-associates": {"phone": "(352) 629-7505", "sources": {"phone": "https://www.ocalafl.gov/home/showpublisheddocument/29183"}},
  "alumitechs-aluminum-and-screening": {"phone": "863-508-5147", "website": "http://www.alumitechsllc.com/", "sources": {"phone": "http://www.alumitechsllc.com/", "website": "http://www.alumitechsllc.com/"}},
  "anchor-homes-and-development-group": {"phone": "(407) 227-6819", "website": "https://www.anchorhomesorlando.com", "contactName": "Scott Pennington", "contactTitle": "Director of Purchasing", "sources": {"contact": "https://www.anchorhomesorlando.com/", "phone": "https://www.anchorhomesorlando.com/", "website": "https://www.anchorhomesorlando.com/"}},
  "anderson-place-construction": {"phone": "(407) 704-4333", "website": "https://www.ap-const.com/", "email": "neal@ap-const.com", "contactName": "John D Henderson II", "contactTitle": "Owner", "sources": {"contact": "https://www.bbb.org/us/fl/orlando/profile/construction-services/anderson-place-construction-llc-0733-90143480", "email": "https://abccentralflorida.com/wp-content/uploads/2026/03/26-27_ABC-CF_Directory_-Ratecard.pdf", "phone": "https://abccentralflorida.com/wp-content/uploads/2026/03/26-27_ABC-CF_Directory_-Ratecard.pdf", "website": "https://www.ap-const.com/"}},
  "apex-construction-of-north-florida": {"phone": "(352) 209-9965", "sources": {"phone": "https://www.bbb.org/us/fl/ocala/profile/home-builders/apex-construction-of-north-florida-llc-0733-235960921"}},
  "atta-construction": {"contactName": "Jean Alexandre Atta Neto", "contactTitle": "Authorized Representative", "sources": {"contact": "https://search.sunbiz.org"}},
  "barefoot-brothers-construction": {"phone": "(407) 960-4834", "website": "http://barefootbrothersconstruction.com/", "email": "ron@barefootbrothers.net", "contactName": "Ronald A. Scarpa", "contactTitle": "Principal Contact / Qualifying Agent (DBPR)", "sources": {"contact": "https://www.bbb.org/us/fl/winter-park/profile/building-contractors/barefoot-brothers-construction-llc-0733-90259840", "email": "https://cityofwinterpark.org/docs/government/boards/historical-archive/agendas/BOA-agd-2018-03-21.pdf", "phone": "https://www.bbb.org/us/fl/winter-park/profile/building-contractors/barefoot-brothers-construction-llc-0733-90259840", "website": "http://barefootbrothersconstruction.com/"}, "phoneVerified": true},
  "basso-homes": {"phone": "(407) 427-0500", "website": "http://bassohomes.com/", "email": "info@bassohomes.com", "contactName": "Justin Basso", "contactTitle": "Founder", "sources": {"contact": "https://bluetoad.com/publication/?i=814334&p=11&view=issueViewer", "email": "http://bassohomes.com/", "phone": "https://custombuilt.com/home-builder-directory/", "website": "https://custombuilt.com/home-builder-directory/"}},
  "batia-construction": {"phone": "(407) 517-9617", "website": "https://batiacc.com/", "contactName": "Mark Batia", "contactTitle": "Manager / Managing Member (Sunbiz)", "sources": {"contact": "http://search.sunbiz.org/Inquiry/corporationsearch/SearchResultDetail?inquirytype=EntityName&directionType=Initial&searchNameOrder=BATIACONSTRUCTION%20L170001004731&aggregateId=flal-l17000100473-d899cc4f-a1c3-46b1-bb78-491d742b73ea&searchTerm=BATIA%20CONSTRUCTION%20COMPANY%2C%20LLC&listNameOrder=BATIACONSTRUCTION%20L170001004731", "phone": "https://batiacc.com/", "website": "https://batiacc.com/"}},
  "baxton-homes": {"phone": "(352) 693-3340", "sources": {"phone": "https://meta.ai?place_id=1637547694130208"}},
  "bella-florida-homes": {"contactName": "Daniel Bourque", "contactTitle": "Certified Building Contractor / Primary Qualifying Agent (CBC1263752)", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=7574058"}},
  "bkn-brickman": {"phone": "(407)520-6994", "contactName": "Michelle Pludwinski", "contactTitle": "President", "sources": {"contact": "https://www.bizprofile.net/fl/celebration/bkn-brickman-corp"}},
  "bobs-pools-and-screens": {"phone": "(407) 834-7100", "website": "http://bobspoolsandscreens.com/", "email": "info@completeoutdoors.com", "sources": {"email": "http://bobspoolsandscreens.com/", "phone": "http://bobspoolsandscreens.com/", "website": "http://bobspoolsandscreens.com/"}},
  "brad-l-morgan-construction": {"phone": "(407) 647-4459", "sources": {"phone": "https://www.bbb.org/us/fl/new-smyrna-beach/profile/construction-services/brad-l-morgan-construction-inc-0733-90334853"}, "phoneVerified": true},
  "build-4-u-homes": {"contactName": "Nohar Sumasar", "contactTitle": "President", "sources": {"contact": "https://static.bizprofile.net/florida%2Forlando%2Fb%2Fp05000013570%2F04282601.pdf"}},
  "bullhorn-construction-le": {"website": "http://bullhornconstruction.com/", "contactName": "Amilcar Velazquez", "contactTitle": "Manager", "sources": {"contact": "https://static.bizprofile.net/8/6/7/0/6/4/86706470.pdf", "website": "http://bullhornconstruction.com/"}},
  "bureau-veritas-north-america": {"phone": "(888) 357-7020", "website": "https://www.bvna.com/", "sources": {"phone": "https://www.bvna.com/certification", "website": "http://www.bvna.com/"}},
  "bwc-construction-bwc-constructing-contracting-in": {"phone": "(352) 644-8383", "website": "https://www.bwc-construction.com/", "email": "info@bwc-construction.com", "contactName": "Bryan W. Caracciolo", "contactTitle": "President / Founder", "sources": {"contact": "https://www.bwc-construction.com/", "email": "https://www.bwc-construction.com/", "phone": "https://www.bwc-construction.com/", "website": "https://www.bwc-construction.com/"}},
  "by-his-grace-development": {"phone": "(352) 207-5030", "contactName": "Reginald Thomas", "contactTitle": "Applicant / Registered Agent", "sources": {"contact": "https://www.ocalafl.gov/home/showpublisheddocument/28730/638923962981400000", "phone": "https://www.ocalafl.gov/home/showpublisheddocument/28730/638923962981400000"}},
  "carl-corley-construction": {"phone": "(321) 267-4964", "website": "http://carlcorleyconstruction.com/", "contactName": "Carl Wayne Corley", "contactTitle": "President", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=EntityName&directionType=Initial&searchNameOrder=CARLCORLEYCONSTRUCTION%20P030001200250&aggregateId=domp-p03000120025-42dcd592-37e4-4634-acfa-27b73528b8ff&searchTerm=%25%20CARL%20COLEY&listNameOrder=CARLCOLLETTICONSULTING%20L200003305470", "phone": "http://carlcorleyconstruction.com/", "website": "http://carlcorleyconstruction.com/"}},
  "cas-construction": {"phone": "(321) 945-0242", "website": "http://www.casconstructions.com", "contactName": "Hernando Castano", "contactTitle": "President", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=4342428", "website": "http://www.casconstructions.com"}},
  "central-construction-group": {"phone": "(305)409-9868", "contactName": "Rene J Fernandez", "contactTitle": "Manager Member / Primary Qualifying Agent (CGC1520384)", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=4090526"}},
  "charles-clayton-construction": {"phone": "(407) 628-3334", "website": "http://www.charlesclayton.com/", "contactName": "Charles Clayton", "contactTitle": "President", "sources": {"contact": "https://www.bbb.org/us/fl/winter-park/profile/home-builders/charles-clayton-construction-inc-0733-12001998", "phone": "http://www.charlesclayton.com/", "website": "http://www.charlesclayton.com/"}},
  "cornerstone-security": {"phone": "(770) 448-9042", "website": "https://cornercs.com/", "email": "CornerstoneService@cornercs.com", "contactName": "Daren P. Hoeffner", "contactTitle": "President", "sources": {"contact": "https://search.sunbiz.org/Inquiry/corporationsearch/SearchResultDetail?inquirytype=EntityName&directionType=PreviousList&searchNameOrder=CORNERSTONESECURITY%20F130000011190&aggregateId=forp-f13000001119-2cb9b35b-75cb-41b7-a485-23f80c556ac6&searchTerm=CORNERSTONE%20STEEL%20DETAILING%2C%20LLC&listNameOrder=CORNERSTONESCHOOL%207616870", "email": "https://cornercs.com/", "phone": "https://cornercs.com/", "website": "https://cornercs.com/"}},
  "cove-points-marine-construction": {"phone": "(386) 575-8605", "website": "https://covepoints.com/cpmc/", "contactName": "Sean Wydronkowski", "contactTitle": "CEO / President", "sources": {"contact": "https://covepoints.com/cpmc/team/", "phone": "https://covepoints.com/cpmc/", "website": "https://covepoints.com/cpmc/"}},
  "crewpro": {"phone": "(407) 692-0765", "email": "crewcontractors@yahoo.com", "contactName": "Darryl Culbreth", "contactTitle": "President", "sources": {"contact": "https://www.bbb.org/us/fl/orlando/profile/remodeling/hammer-pro-inc-0733-90822335", "email": "https://publicrecords.sanfordfl.gov/WebLink/DocView.aspx?id=619182&dbid=0&repo=Sanford", "phone": "https://www.bbb.org/us/fl/orlando/profile/remodeling/hammer-pro-inc-0733-90822335"}},
  "custom-screens": {"phone": "(407) 277-1028", "website": "https://customscreensinc.com/", "email": "info@customscreensinc.com", "contactName": "Terry Davis", "contactTitle": "President and CEO", "sources": {"contact": "https://customscreensinc.com/meet-our-team/", "email": "https://customscreensinc.com/", "phone": "https://customscreensinc.com/", "website": "https://customscreensinc.com/"}},
  "di-francesco": {"contactName": "Fabio Di Francesco", "contactTitle": "Authorized Member", "sources": {"contact": "https://static.bizprofile.net/fl17/9/3/8/1/9/9/938199.pdf"}},
  "doxmi-holdings": {"phone": "(561) 346-0543", "website": "https://doxmiholdings.com/", "email": "doxmiholdings@gmail.com", "contactName": "John S. Krause", "contactTitle": "Authorized Member", "sources": {"contact": "http://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=EntityName&directionType=PreviousList&searchNameOrder=DOXMIHOLDINGS%20L160000801590&aggregateId=flal-l16000080159-e0768bfa-52d6-47bd-b4ca-6f3ba27837ba&searchTerm=DOYA%20SERVICES%20LLC&listNameOrder=DOXIETALESRESCUE%20N150000095690", "email": "https://doxmiholdings.com/", "phone": "https://doxmiholdings.com/", "website": "https://doxmiholdings.com/"}, "phoneVerified": true},
  "dsw-homes": {"phone": "(409) 744-3400", "website": "https://www.dswhomes.com", "email": "info@dswhomes.com", "contactName": "Ashley Dunne", "contactTitle": "Central Florida Program Manager", "sources": {"contact": "https://www.dswhomes.com/ashley-dunne", "email": "https://www.dswhomes.com/ashley-dunne", "phone": "https://www.dswhomes.com/ashley-dunne", "website": "https://www.dswhomes.com/ashley-dunne"}},
  "dulando-screen-and-awning": {"phone": "(407) 862-6060", "website": "https://dulandoscreen.com/", "email": "estimating@dulandoscreen.com", "sources": {"email": "https://dulandoscreen.com/how-much-does-a-screen-enclosure-cost-in-florida/", "phone": "https://dulandoscreen.com/altamonte-springs", "website": "https://dulandoscreen.com/altamonte-springs"}},
  "dustin-perry-construction": {"phone": "(352) 233-9183", "contactName": "Dustin Perry", "contactTitle": "Authorized Member (AMBR)", "sources": {"contact": "http://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=OfficerRegisteredAgentName&directionType=ForwardList&searchNameOrder=PERRYDUSTINALAN+L210002684251&aggregateId=flal-l21000268425-7a030a35-d58c-443f-a235-774329e66b6d&searchTerm=Perry+++++++++++++++Douglas&listNameOrder=PERRYDRDWAYNEC+L230001084241", "phone": "https://www.ocalafl.gov/home/showpublisheddocument/32753/639249729897670000"}},
  "eagle-homes-construction": {"phone": "(407) 489-7139", "contactName": "Zachary Huebner", "contactTitle": "Manager (BBB Principal Contact)", "sources": {"contact": "https://www.bbb.org/us/fl/lake-mary/profile/home-builders/eagle-homes-construction-llc-0733-90713672", "phone": "https://www.bbb.org/us/fl/lake-mary/profile/home-builders/eagle-homes-construction-llc-0733-90713672"}, "phoneVerified": true},
  "envy-homes": {"phone": "(407) 383-2490", "website": "https://www.buildenvy.com", "email": "contactus@buildenvy.com", "contactName": "Steven Earl", "contactTitle": "President", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?InquiryType=OfficerRegisteredAgentName&InquiryDirectionType=ForwardRecord&SearchTerm=Earl++++++++++++++++Stacy+++++++++D&SearchNameOrder=EARLSTEVENR+L060000294322&ListNameOrder=EARLSTACYD+L190002518681&Detail=FL.DOS.Corporations.Shared.Contracts.FilingRecord", "email": "https://www.buildenvy.com", "phone": "https://www.bbb.org/us/fl/orlando/profile/construction-services/envy-homes-llc-0733-90416439", "website": "https://www.buildenvy.com"}},
  "epic-builders-xpert": {"phone": "689-287-7283", "website": "https://www.epicbuildersxpert.net/", "email": "info@EpicBuildersXpert.com", "contactName": "Oriana Squeo", "contactTitle": "Authorized Member (Sunbiz filing)", "sources": {"contact": "https://static.bizprofile.net/8/8/2/4/2/9/88242968.pdf", "email": "https://epicbuildersxpert.com/", "phone": "https://www.epicbuildersxpert.net/", "website": "https://www.epicbuildersxpert.net/"}},
  "er-fusion": {"phone": "(407) 734-8419", "website": "https://www.erfusion.com", "contactName": "Ehmad Farhat", "contactTitle": "Owner", "sources": {"contact": "https://www.bbb.org/us/fl/windermere/profile/property-maintenance/er-fusion-property-maintenance-0733-90725938", "phone": "https://www.bbb.org/us/fl/windermere/profile/property-maintenance/er-fusion-property-maintenance-0733-90725938", "website": "https://www.bbb.org/us/fl/windermere/profile/property-maintenance/er-fusion-property-maintenance-0733-90725938"}},
  "escale-group": {"contactName": "Simone C. Pedreschi Rodriguez", "contactTitle": "Authorized Member", "sources": {"contact": "https://static.bizprofile.net/8/6/9/7/2/6/86972681.pdf"}},
  "fabian-construction": {"phone": "(352) 694-5000", "website": "https://fabianconstruction.com/", "email": "eric@fabianconstruction.com", "contactName": "John Eric Fabian", "contactTitle": "Manager / Primary Contact", "sources": {"contact": "https://marionfl.legistar1.com/marionfl/attachments/c429e5c7-c9ed-4ff0-909e-12263d0a5ff5.pdf", "email": "https://marionfl.legistar1.com/marionfl/attachments/c429e5c7-c9ed-4ff0-909e-12263d0a5ff5.pdf", "phone": "https://marionfl.legistar1.com/marionfl/attachments/c429e5c7-c9ed-4ff0-909e-12263d0a5ff5.pdf", "website": "https://fabianconstruction.com/"}},
  "fiesta-contracting": {"phone": "(407) 402-9233", "contactName": "Richard A. Lemley", "contactTitle": "President", "sources": {"contact": "https://www.wgpd.com/AgendaCenter/ViewFile/Minutes/_06232021-726"}},
  "finish-line-screens": {"phone": "(407) 453-6335", "website": "https://finishlinescreens.com/", "sources": {"phone": "https://www.bbb.org/us/fl/oviedo/profile/screen-enclosures/finish-line-screens-inc-0733-235958584/email-this-business?email=sales", "website": "https://finishlinescreens.com/"}},
  "florida-master-roofing": {"phone": "(689) 278-6953", "website": "http://www.floridamasterroofing.com/", "contactName": "Pablo Gonzalez", "contactTitle": "President", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/GetDocument?aggregateId=flal-l23000155543-808c4bc1-6906-4ebb-8efa-253b5b69b5d9&transactionId=l23000155543-re-66bf4395-e0f4-4170-961b-2436834e1634&formatType=PDF", "phone": "http://www.floridamasterroofing.com/", "website": "http://www.floridamasterroofing.com/"}},
  "florida-pool-enclosures": {"phone": "(407) 260-2800", "website": "https://www.floridapoolenclosures.com/", "email": "floridapoolenclosures@gmail.com", "sources": {"email": "https://www.floridapoolenclosures.com/services", "phone": "https://www.floridapoolenclosures.com/services", "website": "https://www.floridapoolenclosures.com/services"}},
  "focco-construction-and-design": {"phone": "+1 (321) 270-0870", "website": "http://foccocd.com/", "email": "info@foccocd.com", "contactName": "Felipe De Oliveira Cortes", "contactTitle": "Certified General Contractor / license qualifier (DBPR CGC1526317)", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=D53C5D8A5D2E9ECF502FC53E602B5398", "email": "http://foccocd.com/", "phone": "http://foccocd.com/", "website": "http://foccocd.com/"}},
  "ford-design-group": {"phone": "(321) 231-4518", "email": "fordrecovery@gmail.com", "contactName": "Zurny DeShawn Ford", "contactTitle": "Owner", "sources": {"contact": "https://www.bbb.org/us/fl/groveland/profile/roofing-contractors/the-ford-design-group-llc-0733-142707054", "email": "https://www.prorfx.com/bids/RFQ03062400000044", "phone": "https://www.prorfx.com/bids/RFQ03062400000044"}},
  "glyn-dale-builders": {"phone": "(352) 369-0911", "website": "http://www.glyndalebuilders.com/", "contactName": "Richard G. Norton", "contactTitle": "Owner and President", "sources": {"contact": "https://www.bbb.org/us/fl/ocala/profile/home-builders/glyn-dale-builders-inc-0733-4003758/details", "phone": "https://www.bbb.org/us/fl/ocala/profile/home-builders/glyn-dale-builders-inc-0733-4003758/details", "website": "http://www.glyndalebuilders.com/"}},
  "go-solar-power": {"phone": "(800) 530-9597", "website": "https://www.gosolarpower.com/", "email": "info@gosolarpower.com", "sources": {"email": "https://www.gosolarpower.com/locations/", "phone": "https://www.gosolarpower.com/locations/", "website": "https://www.gosolarpower.com/locations/"}},
  "goehring-and-morgan-construction": {"phone": "(407) 650-2002", "website": "http://goehringandmorgan.com", "email": "info@goehringandmorgan.com", "contactName": "Bo Morgan", "contactTitle": "Managing Partner", "sources": {"contact": "http://goehringandmorgan.com/", "email": "https://bluetoad.com/publication/?i=859656&p=106&view=issueViewer", "website": "http://goehringandmorgan.com/"}},
  "gtg-spire-homes": {"phone": "(813) 326-6609", "website": "https://myspirehomes.com", "email": "info@myspirehomes.com", "sources": {"email": "https://myspirehomes.com/contact/", "phone": "https://myspirehomes.com/contact/", "website": "https://myspirehomes.com/contact/"}},
  "h-and-m-construction-solutions": {"phone": "(407) 913-2523", "website": "http://www.h-mconstructions.com/", "contactName": "Carlos Hernandez", "contactTitle": "Leader / Certified General Contractor", "sources": {"contact": "http://www.h-mconstructions.com/", "phone": "http://www.h-mconstructions.com/", "website": "http://www.h-mconstructions.com/"}},
  "hanson-tobin-construction": {"phone": "(407) 729-3552", "contactName": "Anthony W. Tobin", "contactTitle": "Manager (Sunbiz filing)", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/GetDocument?aggregateId=flal-l03000016992-566570bc-30b8-40ed-8f39-6539bdccc86d&transactionId=l03000016992-ac954a04-b7fa-43a1-8997-d8354bc5413d&formatType=PDF", "phone": "https://meta.ai?place_id=459260793159064"}},
  "harvey-g-newsome-jr": {"contactName": "Harvey Gay Newsome Jr", "contactTitle": "President / Primary Qualifying Agent (CRC057318)", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=830220"}},
  "hayden-construction": {"phone": "(352) 867-1389", "contactName": "Owen Hayden Jr.", "contactTitle": "Principal Contact / Business Management", "sources": {"contact": "https://www.bbb.org/us/fl/ocala/profile/general-contractor/hayden-construction-inc-0733-235968967", "phone": "https://www.bbb.org/us/fl/ocala/profile/general-contractor/hayden-construction-inc-0733-235968967"}},
  "homes-by-carousel": {"phone": "(757) 348-4445", "website": "https://www.homesbycarousel.com/", "contactName": "Micah Clymer", "contactTitle": "Founder / Owner, Licensed FL Residential Contractor", "sources": {"contact": "https://www.homesbycarousel.com/about/", "phone": "https://www.homesbycarousel.com/", "website": "https://www.homesbycarousel.com/"}},
  "homes-by-west-bay": {"phone": "(813) 438-3838", "website": "https://www.homesbywestbay.com/", "email": "onlinesales@westbaytampa.com", "sources": {"email": "https://www.homesbywestbay.com/mlp/pasadena-woods-wesley-chapel-fl-new-homes", "phone": "https://www.homesbywestbay.com/site-map", "website": "https://www.homesbywestbay.com/"}},
  "hope-construction-services": {"phone": "(407) 920-8550", "website": "https://www.hcsfla.com", "contactName": "Aaron Hope", "contactTitle": "Founder", "sources": {"contact": "https://www.hcsfla.com/team/", "phone": "https://www.hcsfla.com/team/", "website": "https://www.hcsfla.com/team/"}},
  "inspectfl": {"contactName": "Jeremy Shane Gerwig", "contactTitle": "Licensed Private Provider / Building Inspector (FL Lic. BU1598)"},
  "j-drewes-construction": {"phone": "(407) 744-3133", "website": "http://www.jdrewesconstruction.com", "contactName": "Jason Drewes", "contactTitle": "Certified Building Contractor (licensee, CBC1257162)", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=3AFD8B525FC8C932AC56E5DB251B2EE9", "phone": "https://www.bbb.org/us/fl/clermont/profile/building-contractors/j-drewes-construction-llc-0733-90204975", "website": "http://www.jdrewesconstruction.com/contact/"}},
  "jasper-custom-homes": {"phone": "(863) 267-0007", "website": "https://builtbyjasper.com/", "email": "scott@builtbyjasper.com", "contactName": "Scott Edward Paul", "contactTitle": "Owner / Primary Qualifying Agent", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=7F7646CBBC4CAB61CBA39D5712ED98FB", "email": "https://builtbyjasper.com/testimonial/", "phone": "https://builtbyjasper.com/testimonial/", "website": "https://builtbyjasper.com/testimonial/"}},
  "jerry-walters-construction": {"phone": "(352) 585-2763", "email": "Jerrywaltersconstructioninc@gmail.com", "contactName": "Jerry Gene Walters", "contactTitle": "Owner / Qualifying Agent (FL Lic. CRC1326355)", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=EE023D23A2FC04577218FF164E0F996B", "email": "https://cms6.revize.com/revize/taylorcounty/BCC 09.21.23 S.pdf?t=202310251124130&t=202310251124130", "phone": "https://cms6.revize.com/revize/taylorcounty/BCC 09.21.23 S.pdf?t=202310251124130&t=202310251124130"}},
  "john-a-rankin-construction": {"phone": "(352) 732-3316", "website": "http://jrankinconstruction.com/", "contactName": "John A Rankin", "contactTitle": "President", "sources": {"contact": "https://www.bbb.org/us/fl/ocala/profile/general-contractor/john-a-rankin-construction-company-inc-0733-4003597", "phone": "https://www.bbb.org/us/fl/ocala/profile/general-contractor/john-a-rankin-construction-company-inc-0733-4003597", "website": "http://jrankinconstruction.com/"}},
  "justice-and-wood-builders": {"phone": "(407) 395-4687", "website": "https://www.justice-wood.com", "contactName": "Brian Justice & Bill Wood", "contactTitle": "Co-Founders / Principals", "sources": {"contact": "https://www.instagram.com/justicewoodbuilders", "phone": "https://www.justice-wood.com/", "website": "https://www.justice-wood.com/"}},
  "konkol-custom-homes-and-remodeling": {"phone": "(407) 539-2938", "website": "https://konkolcustom.com/", "email": "contact@konkolcustom.com", "contactName": "David Konkol", "contactTitle": "Founder", "sources": {"contact": "https://konkolcustom.com/", "email": "https://konkolcustom.com/2019-parade-of-homes-lp/", "phone": "https://konkolcustom.com/", "website": "https://konkolcustom.com/"}},
  "kurco-construction": {"phone": "(904) 509-3858", "website": "https://www.kurcoconstruction.com/", "email": "matt@kurcoconstruction.com", "contactName": "Ronald Matthew Kurtz", "contactTitle": "Primary Qualifying Agent", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=6361587", "email": "https://www.kurcoconstruction.com/", "phone": "https://www.kurcoconstruction.com/", "website": "https://www.kurcoconstruction.com/"}},
  "lahr-construction": {"phone": "(407) 702-4315", "website": "https://mlahrhomes.com/", "contactName": "Mike Lahr", "contactTitle": "Owner / Builder", "sources": {"contact": "https://mlahrhomes.com/", "phone": "https://www.bbb.org/us/fl/orlando/profile/home-builders/lahr-construction-llc-0733-90327662", "website": "https://mlahrhomes.com/"}},
  "land-marks": {"contactName": "Asif Huda Khan", "contactTitle": "Certified General Contractor / DBPR Licensee (Qualifier)", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=B16B3FC73A31F1BC1E107901AD659B38"}},
  "ldt-construction": {"contactName": "Colleen Tinari", "contactTitle": "President", "sources": {"contact": "https://static.bizprofile.net/8/5/4/5/9/5/85459583.pdf"}},
  "legendary-construction-remodeling": {"phone": "(352) 398-7199", "website": "https://www.legendarycr.com/", "email": "sean@legendarycr.com", "contactName": "Sean A. Schrader", "contactTitle": "President", "sources": {"contact": "https://www.bbb.org/us/fl/spring-hill/profile/building-contractors/legendary-construction-remodeling-inc-0653-90335024", "email": "https://www.legendarycr.com/", "phone": "https://www.bbb.org/us/fl/spring-hill/profile/building-contractors/legendary-construction-remodeling-inc-0653-90335024", "website": "https://www.legendarycr.com/"}},
  "lm-gilbert": {"phone": "(407) 645-4099", "website": "https://lmgilbert.com/", "email": "office@lmgilbert.com", "contactName": "Lyn M. Gilbert", "contactTitle": "Owner / Licensed Contractor", "sources": {"contact": "https://lmgilbert.com/", "email": "https://lmgilbert.com/", "phone": "https://lmgilbert.com/", "website": "https://lmgilbert.com/"}},
  "loga-homes": {"contactName": "Franklin David Rivera", "contactTitle": "Primary Qualifying Agent", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=7923805"}},
  "mark-norman-construction-cgc": {"phone": "(352) 572-3030", "contactName": "Mark C. Norman", "contactTitle": "President", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=30C69601510B26FF19B698DDA5262AAC", "phone": "https://www.bbb.org/us/fl/ocala/profile/construction-services/mark-norman-construction-inc-0733-90010602"}},
  "mbo-roofing": {"phone": "(877) 697-6631", "website": "http://mboroof.com/", "email": "info@mboroof.com", "contactName": "Sebastian Simancas", "contactTitle": "President", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=EntityName&directionType=CurrentList&searchNameOrder=MBOROOFING%20P230000377760&aggregateId=domp-p23000037776-d2751398-8a54-49a7-9873-f02c692c7e99&searchTerm=MBO%20INVESTMENTS%20LLC&listNameOrder=MBORDEY%20P020001338760", "email": "http://mboroof.com/", "phone": "http://mboroof.com/", "website": "http://mboroof.com/"}},
  "md-construction": {"phone": "(407) 233-5098", "website": "https://mdconstructionfl.com/", "contactName": "Marcos R Davila", "sources": {"contact": "https://c.lakecountyfl.gov/permit_report.ashx?type=history&number=2024070723", "phone": "https://c.lakecountyfl.gov/permit_report.ashx?type=history&number=2024070723", "website": "https://mdconstructionfl.com/"}},
  "mechanical-one": {"phone": "(407) 404-4000", "website": "https://mechanicalone.com/", "email": "info@mechanicalone.com", "contactName": "Jason James", "contactTitle": "Founder, President and CEO", "sources": {"contact": "https://mechanicalone.com/about/", "email": "https://mechanicalone.com/terms-of-use/", "phone": "https://mechanicalone.com/terms-of-use/", "website": "https://mechanicalone.com/"}},
  "mejia-international-group": {"phone": "(954) 675-2652", "email": "dmejia@mejiatelecom.com", "contactName": "Diego Mejia", "contactTitle": "Company contact (state/county vendor listings)", "sources": {"contact": "https://purchasingbids.charlottecountyfl.gov/ContractsCatalogs/ShowDoc/223293?tp=D", "email": "https://purchasingbids.charlottecountyfl.gov/ContractsCatalogs/ShowDoc/223293?tp=D", "phone": "https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=3617143"}},
  "michael-charles-homes": {"phone": "(407) 925-7595", "website": "https://michaelcharleshomes.com/", "contactName": "Darr Hill", "sources": {"contact": "https://www.bbb.org/us/fl/longwood/profile/home-builders/michael-charles-homes-llc-0733-90252082", "phone": "https://michaelcharleshomes.com/", "website": "https://michaelcharleshomes.com/"}},
  "mikel-construction": {"phone": "(321) 436-9759", "contactName": "Kelly Ann Miller", "contactTitle": "Primary Qualifying Agent", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=6362088", "phone": "https://www.bbb.org/us/fl/winter-garden/profile/home-builders/mikel-construction-llc-0733-235979484"}},
  "national-general-contractors": {"contactName": "Knute M. McAlister", "contactTitle": "Licensee (DBA National General Contractors)", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=ACB47274C60507E2F3C4B288586A1A7C"}},
  "nds-development": {"phone": "(407) 291-8008", "contactName": "Devindra Harilal", "contactTitle": "Certified General Contractor (qualifying agent, CGC1515329)", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=0FDB9C9E7E4CE54584572C607330AC3D", "phone": "https://meta.ai?place_id=1725177214516704"}},
  "new-york-group-and": {"phone": "(407) 205-6325", "website": "http://newyorkgroup-company.com/", "email": "rogerio.xavier@gmail.com", "contactName": "Rogerio Xavier", "contactTitle": "General Contractor (owner; Sunbiz Authorized Member)", "sources": {"contact": "http://newyorkgroup-company.com/", "email": "http://newyorkgroup-company.com/", "phone": "http://newyorkgroup-company.com/", "website": "http://newyorkgroup-company.com/"}},
  "newco-homes-of-ocala": {"phone": "(352) 620-8290", "sources": {"phone": "https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&query_string=829727"}},
  "next-generation-homes": {"phone": "(352) 398-8050", "website": "https://next-generation-homes.com", "sources": {"phone": "https://www.bbb.org/us/fl/brooksville/profile/custom-home-builder/next-generation-homes-llc-0653-90453099", "website": "https://next-generation-homes.com/"}},
  "ocala-residential-construction-services": {"phone": "(352) 351-8153", "website": "https://orcshomes.com", "email": "Build@orcshomes.com", "sources": {"email": "https://orcshomes.com/", "phone": "https://orcshomes.com/", "website": "https://orcshomes.com/"}},
  "one-touch-general-contracting": {"phone": "(321) 442-5548", "contactName": "Devon D. Carty", "contactTitle": "Qualifying Agent / Certified General Contractor", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=6987210"}},
  "ordonez-ordonez-construction": {"phone": "(352) 780-8182", "website": "https://www.ordconstruction.com/", "sources": {"phone": "https://www.ordconstruction.com/orlando", "website": "https://www.ordconstruction.com/orlando"}},
  "parthenon-restoration-remodeling": {"phone": "(727) 647-7788", "website": "http://www.parthenonrestoration.com/", "sources": {"phone": "https://www.bbb.org/us/fl/new-port-richey/profile/fire-water-damage-restoration/parthenon-restoration-remodeling-inc-0653-90086672", "website": "http://www.parthenonrestoration.com/"}},
  "partners-in-construction": {"phone": "855-208-2171", "website": "https://www.partnersinc.net", "email": "services@partnersinc.net", "sources": {"email": "https://www.partnersinc.net/", "phone": "https://www.partnersinc.net/", "website": "https://www.partnersinc.net/"}},
  "paverscape": {"phone": "407-381-1022", "website": "https://www.paverscapeincfl.com/", "sources": {"phone": "https://www.paverscapeincfl.com/contact/", "website": "https://www.paverscapeincfl.com/"}, "phoneVerified": true},
  "pittman-and-sons": {"phone": "(321) 505-7537", "website": "https://psoutdoorliving.com/", "email": "pittman.sons@gmail.com", "contactName": "Garrett Pittman", "contactTitle": "Owner", "sources": {"contact": "https://psoutdoorliving.com/about-us/", "email": "https://psoutdoorliving.com/", "phone": "https://psoutdoorliving.com/", "website": "https://psoutdoorliving.com/"}},
  "precise-screens": {"phone": "(407) 951-8015", "website": "https://precisescreens.com/", "email": "info@precisescreens.com", "sources": {"email": "https://precisescreens.com/", "phone": "https://precisescreens.com/", "website": "https://precisescreens.com/"}},
  "precision-luxury-aquatics": {"phone": "407-987-1488", "website": "https://precisionluxuryaquatics.com/", "email": "jerrod.blair@precisionluxuryaquatics.com", "contactName": "Jerrod Blair", "sources": {"contact": "https://precisionluxuryaquatics.com/", "email": "https://precisionluxuryaquatics.com/", "phone": "https://precisionluxuryaquatics.com/", "website": "https://precisionluxuryaquatics.com/"}},
  "prime-kubrusly-basso-home": {"contactName": "Daniela de Oliveira Machado Pedrosa", "contactTitle": "Manager", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/GetDocument?aggregateId=flal-l25000504242-9b0cfc7a-31ee-4a1d-a914-12b1501856d6&transactionId=l25000504242-6ba32bb4-0218-49c0-a079-62749d5fc73d&formatType=PDF"}},
  "probuiltu-s": {"phone": "(352) 835-7995", "website": "http://probuiltus.com", "contactName": "Bobby Eaton", "contactTitle": "Owner", "sources": {"contact": "https://probuiltus.com/", "phone": "https://www.bbb.org/us/fl/spring-hill/profile/general-contractor/probuiltus-inc-0653-90210628", "website": "https://probuiltus.com/"}},
  "pure-air-and-heating": {"phone": "(833) 869-1300", "website": "https://www.pureairandheating.com/", "email": "Customercare@pureairandheating.com", "sources": {"email": "https://pureairandheating.com/contact/", "phone": "https://pureairandheating.com/contact/", "website": "https://www.pureairandheating.com/"}, "phoneVerified": true},
  "q-ice-builders": {"phone": "407-929-1100", "website": "https://q-icebuilders.com/", "sources": {"phone": "https://q-icebuilders.com/", "website": "https://q-icebuilders.com/"}, "phoneVerified": true},
  "ray-s-construction-of-ocala": {"phone": "352-266-7325", "website": "http://raysconstructionofocala.com/", "email": "andreas@RaysConstructionofOcala.com", "contactName": "Raphael (Ray) Samuel", "sources": {"contact": "http://raysconstructionofocala.com/", "email": "http://raysconstructionofocala.com/", "phone": "http://raysconstructionofocala.com/", "website": "http://raysconstructionofocala.com/"}},
  "res-contracting-svcs": {"contactName": "Juan D. Rivera", "contactTitle": "President", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/GetDocument?aggregateId=flal-l10000102783-88df848c-667a-41e0-825f-26c856613b78&transactionId=l10000102783-3aca04e0-fd50-4564-85e3-1ab40e41d904&formatType=PDF"}},
  "rjh-construction-dba-horn-general-contracting": {"contactName": "Robert J. Horn", "contactTitle": "Licensee, Horn General Contracting", "sources": {"contact": "https://www.myfloridalicense.com/portalsearches/VerifyLicensee/LicenseDetail?ID=CCD7560EA76F0046FFDD9B993698885D"}},
  "roof-depot": {"phone": "(407) 548-6733", "website": "http://www.roofdepot.com/", "email": "info@roofdepot.com", "contactName": "Terry Dickerson", "contactTitle": "Certified Roofing Contractor / Qualifying Agent (DBPR)", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=2914128", "email": "https://roofdepot.com/florida-roofers/", "phone": "https://roofdepot.com/florida-roofers/", "website": "http://www.roofdepot.com/"}},
  "safer-grounds-construction": {"contactName": "William Dermody", "contactTitle": "Owner/Manager", "sources": {"contact": "https://www.bbb.org/us/fl/hudson/profile/construction/safer-grounds-construction-llc-0653-90403232"}},
  "sbs-builder-services": {"phone": "(407) 466-3104", "website": "https://sbsbuilderservices.com/", "contactName": "Matthew R. Morgioni", "contactTitle": "Owner / General Contractor", "sources": {"contact": "https://sbsbuilderservices.com/contact-us", "phone": "https://sbsbuilderservices.com/contact-us", "website": "https://sbsbuilderservices.com/contact-us"}},
  "shinedeck-outdoor-living": {"phone": "(407) 930-7956", "website": "https://www.shinedeck.com/", "email": "info@shinedeck.com", "sources": {"email": "https://www.shinedeck.com/patio-enclosures", "phone": "https://www.shinedeck.com/patio-enclosures", "website": "https://www.shinedeck.com/patio-enclosures"}},
  "six-a-construction-services": {"contactName": "Sigurd Bo", "contactTitle": "Registered Agent", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/GetDocument?aggregateId=flal-l16000161815-6cc7358c-e48b-4966-b6d0-871d67c03423&transactionId=l16000161815-49e2e883-ff34-4de0-85b4-8530e78055d3&formatType=PDF"}},
  "skyhomes-building-services": {"phone": "(407) 614-8082", "contactName": "Marcus Segnini", "sources": {"contact": "http://search.sunbiz.org/Inquiry/CorporationSearch/GetDocument?aggregateId=flal-l22000076459-413dadd5-c253-4ea9-8a6c-65776c781924&transactionId=l22000076459-91c26bdc-fc21-4ee5-9747-b755abce54c2&formatType=PDF", "phone": "https://members.greaterorlandoba.com/list/searchalpha/s"}},
  "sonny-5-star-electric": {"phone": "(407) 766-5658", "contactName": "Sonny Baran", "contactTitle": "Manager", "sources": {"contact": "https://www.bbb.org/us/fl/orlando/profile/electrician/sonny-5-star-electric-llc-0733-90831651", "phone": "https://www.bbb.org/us/fl/orlando/profile/electrician/sonny-5-star-electric-llc-0733-90831651"}},
  "southern-traditions-development": {"phone": "(407) 948-1051", "website": "https://www.southerntraditionsdev.com", "email": "info@southerntraditionsdev.com", "contactName": "Jon Pleveich", "contactTitle": "Owner", "sources": {"contact": "https://www.southerntraditionsdev.com/about-us/", "email": "https://www.southerntraditionsdev.com/about-us/", "phone": "https://www.southerntraditionsdev.com/about-us/", "website": "https://www.southerntraditionsdev.com/about-us/"}},
  "southern-traditions-roofing": {"phone": "(407) 579-6397", "website": "https://www.southern-traditions-roofing.com/", "email": "apleveich@southern-traditions-roofing.com", "contactName": "August Pleveich", "contactTitle": "President / Founder", "sources": {"contact": "https://www.southern-traditions-roofing.com/about", "email": "https://www.southern-traditions-roofing.com/", "phone": "https://www.southern-traditions-roofing.com/", "website": "https://www.southern-traditions-roofing.com/"}},
  "southernvalley-homes": {"phone": "(352) 200-5199", "website": "https://www.southernvalleyhomes.com/", "email": "sales@southernvalleyhomes.com", "sources": {"email": "https://www.southernvalleyhomes.com/contact", "phone": "https://www.southernvalleyhomes.com/contact", "website": "https://www.southernvalleyhomes.com/contact"}},
  "spirit-building-group": {"phone": "(239) 203-3559", "website": "https://www.spiritbuildinggroup.com/", "email": "Spiritbuildinggroup@gmail.com", "sources": {"email": "https://www.spiritbuildinggroup.com/privacy-policy", "phone": "https://www.spiritbuildinggroup.com/privacy-policy", "website": "https://www.spiritbuildinggroup.com/"}},
  "stalder-construction": {"phone": "(407) 212-1386", "website": "stalderconstruction.com", "contactName": "Hilary Stalder Stern", "contactTitle": "Manager", "sources": {"contact": "https://www.bbb.org/us/fl/winter-park/profile/general-contractor/stalder-construction-llc-0733-90832031", "phone": "https://www.bbb.org/us/fl/winter-park/profile/general-contractor/stalder-construction-llc-0733-90832031", "website": "https://www.bbb.org/us/fl/winter-park/profile/general-contractor/stalder-construction-llc-0733-90832031"}},
  "stone-ridge-builders": {"contactName": "Albert W. Hersh", "contactTitle": "President", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResults?InquiryType=EntityName&InquiryDirectionType=ForwardRecord&SearchTerm=Stone%20Ridge%20At%20Highwoods%20Preserve%20Townhomes%20Owners'%20Association%2C%20Inc.&SearchNameOrder=STONERIDGEATSEBRING%20L050000744020&ListNameOrder=STONERIDGEATHIGHWOODSPRESERVET%20N030000010430&Detail=FL.DOS.Corporations.Shared.Contracts.FilingRecord"}},
  "stonewater": {"website": "https://stonewaterinc.com", "email": "info@stonewaterinc.com", "sources": {"email": "https://www.facebook.com/stonewaterinc", "website": "https://www.facebook.com/stonewaterinc"}},
  "summertime-outdoor-builders": {"phone": "(407) 688-0609", "sources": {"phone": "https://www.bbb.org/us/fl/casselberry/category/screen-enclosures"}},
  "sunshine-screen-enclosures": {"phone": "(407) 688-0786", "website": "https://www.sunshinescreenenclosures.com", "contactName": "Keith Jones", "contactTitle": "President", "sources": {"contact": "https://www.sunshinescreenenclosures.com/contact/", "phone": "https://www.sunshinescreenenclosures.com/", "website": "https://www.sunshinescreenenclosures.com/"}},
  "superior-aluminum-installation": {"phone": "(407) 678-0500", "website": "https://www.yourscreenroom.com/", "sources": {"phone": "https://www.yourscreenroom.com/", "website": "https://www.yourscreenroom.com/"}},
  "superior-aluminum-installations": {"phone": "(407) 678-0500", "website": "https://www.yourscreenroom.com/", "sources": {"phone": "https://www.bbb.org/us/fl/winter-park/profile/screen-enclosures/superior-aluminum-installations-inc-0733-301500", "website": "https://www.yourscreenroom.com/about-us/"}},
  "teggcrete": {"phone": "(407) 455-3516", "sources": {"phone": "https://www.bbb.org/us/fl/orlando/category/concrete-contractors/accredited"}},
  "trinity-family-builders": {"phone": "(407) 214-3860", "website": "https://www.trinityfamilybuilders.com/", "email": "sales@trinityfamilybuilders.com", "contactName": "Larry Aiello", "contactTitle": "New Home Advisor", "sources": {"contact": "https://www.trinityfamilybuilders.com/", "email": "https://www.linkedin.com/company/trinity-family-builders", "phone": "https://www.linkedin.com/company/trinity-family-builders", "website": "https://www.trinityfamilybuilders.com/"}, "phoneVerified": true},
  "truestride-construction": {"phone": "732-861-6509", "email": "Omar@tstride.com", "contactName": "Omar A. Omar", "contactTitle": "Owner / Certified General Contractor (CGC1540226)", "sources": {"contact": "https://www.instagram.com/p/DezNu5JRaAO/", "email": "https://www.instagram.com/p/DeZiSMfsPD6/", "phone": "https://www.instagram.com/p/DeZiSMfsPD6/"}},
  "tuff-shed": {"phone": "(813) 657-6091", "website": "https://www.tuffshed.com/", "email": "lking1@tuffshed.com", "contactName": "Linda King", "sources": {"contact": "https://www.tuffshed.com/blog/press-releases/tuff-shed-tampa-fl-grand-opening", "email": "https://www.tuffshed.com/blog/press-releases/tuff-shed-tampa-fl-grand-opening", "phone": "http://www.tuffshed.com/locations/us/fl/tampa", "website": "http://www.tuffshed.com/locations/us/fl/tampa"}},
  "ues-professional-solutions": {"phone": "(407)429-3303", "website": "https://teamues.com", "email": "COBIPermits@teamues.com", "sources": {"email": "https://teamues.com/wp-content/uploads/COBI-Permit-Exemption-Guidelines.pdf", "website": "https://teamues.com/wp-content/uploads/COBI-Permit-Exemption-Guidelines.pdf"}},
  "universal-concrete-service-general": {"phone": "(352) 427-2548", "website": "http://universalconcreteserviceinc.com", "contactName": "Michael K Farmer", "contactTitle": "President", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=EntityName&directionType=CurrentList&searchNameOrder=UNIVERSALCONCRETESERVICE+P190000156190&aggregateId=domp-p19000015619-408ed0f9-7927-4190-bf75-9dcd09f4fcaa&searchTerm=UNIVERSAL+CONCRETE+AND+READY+MIX+CORP&listNameOrder=UNIVERSALCONCRETEREADYMIX+G292480", "phone": "https://www.ocalafl.gov/home/showpublisheddocument/31182", "website": "http://universalconcreteserviceinc.com"}},
  "urban-perch-a-boutique-home-builder": {"phone": "(407) 281-6666", "website": "https://urbanperchhomes.com/", "email": "erey@urbanperchhomes.com", "contactName": "Eric Rey", "contactTitle": "Manager / Founder", "sources": {"contact": "https://www.bbb.org/us/fl/orlando/profile/custom-home-builder/urban-perch-a-boutique-home-builder-llc-0733-90577962", "email": "https://directory.parkavenuedistrict.com/", "phone": "https://members.greaterorlandoba.com/list/member/urban-perch-a-boutique-home-builder-llc-9225", "website": "https://urbanperchhomes.com/"}},
  "us-aluminum-services": {"phone": "(407) 237-3128", "website": "https://us-aluminum.com/", "sources": {"phone": "https://www.bbb.org/us/fl/orlando/profile/screen-enclosures/us-aluminum-services-corporation-0733-174838390", "website": "https://www.bbb.org/us/fl/orlando/profile/screen-enclosures/us-aluminum-services-corporation-0733-174838390"}, "phoneVerified": true},
  "ve-builders": {"phone": "(407) 440-8529", "website": "https://www.vebuildersllc.com/", "email": "vebuild@volkema.com", "contactName": "Eliot Grime", "contactTitle": "Site and Crew Manager", "sources": {"contact": "https://www.cfri.net/Misc/MemberFiles/CFRI_September_2026_News.pdf", "email": "https://www.vebuildersllc.com/_files/ugd/fb0439_3e7f74bfd30448598737b9970cc9ec6d.pdf?index=true", "phone": "https://www.vebuildersllc.com/faq", "website": "https://www.vebuildersllc.com/faq"}, "phoneVerified": true},
  "verge-properties": {"phone": "(407) 756-9400", "website": "http://www.vergeproperties.com", "contactName": "Christopher R. Barnes", "contactTitle": "Certified General Contractor (CGC1522446)", "sources": {"contact": "https://vergeproperties.com/about", "website": "http://www.vergeproperties.com/"}},
  "wcm-construction-roofing": {"phone": "(863) 969-3722", "website": "https://www.warrencm.com/", "email": "Office@WarrenCM.com", "contactName": "Ronald Todd Warren", "contactTitle": "Owner / Managing Member (Founder)", "sources": {"contact": "https://search.sunbiz.org/Inquiry/CorporationSearch/GetDocument?aggregateId=flal-l08000110925-9acd8485-3624-4bc7-8a25-56c367c3d509&transactionId=l08000110925-cbd67ea8-2593-42b6-a129-2ed20de1d7e4&formatType=PDF", "email": "https://www.warrencm.com/contact", "phone": "https://www.warrencm.com/contact", "website": "https://www.warrencm.com/"}},
  "wjhfl": {"phone": "(239) 810-0395", "website": "https://www.centurycommunities.com", "contactName": "Wade G. Jurney", "contactTitle": "President", "sources": {"contact": "https://www.bbb.org/us/fl/fort-myers/profile/home-builders/century-communities-0653-90213229", "phone": "https://www.bbb.org/us/fl/fort-myers/profile/home-builders/century-communities-0653-90213229", "website": "https://www.bbb.org/us/fl/fort-myers/profile/home-builders/century-communities-0653-90213229"}},
  "your-suncoast-home-solutions": {"phone": "(603) 986-2184", "contactName": "Steven Paul LaFavore", "contactTitle": "Qualifying Agent (FL Lic. CGC1521122)", "sources": {"contact": "https://www.myfloridalicense.com/licenseRelation.asp?SID=&licid=5453735", "phone": "https://safer.fmcsa.dot.gov/query.asp?searchtype=ANY&query_type=queryCarrierSnapshot&query_param=USDOT&original_query_param=NAME&query_string=3931276&original_query_string=YOUR%20SUNCOAST%20HOME%20SOLUTIONS%20INC"}},
  "zoltan-homes": {"phone": "407-515-7315", "website": "https://zoltanhomes.com/", "contactName": "Zoltan Kecskes", "contactTitle": "Co-founder and Partner", "sources": {"contact": "https://zoltanhomes.com/", "phone": "https://zoltanhomes.com/zoltan-builder", "website": "https://zoltanhomes.com/"}},
};

const STATUSES = ["New", "Called", "Interested", "Not interested", "Won"];

export { STATUSES };

export function cleanName(raw) {
  if (!raw) return "";
  return String(raw)
    .replace(/\s+/g, " ")
    .replace(/,?\s*d\/b\/a\s+/i, " ")
    .trim();
}

export function normName(raw) {
  return cleanName(raw)
    .toLowerCase()
    .replace(/[.,'"()]/g, " ")
    .replace(/\b(llc|l l c|inc|incorporated|corp|corporation|co|ltd|limited|company|companies|the)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function slugId(raw) {
  const n = normName(raw) || cleanName(raw).toLowerCase();
  return n.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "unknown";
}

export function isDnc(raw) {
  const n = normName(raw);
  const full = cleanName(raw).toLowerCase();
  if (!n && !full) return true;
  if (DNC_SUBSTR.some((s) => n.includes(s) || full.includes(s))) return true;
  if (DNC_WORD.some((re) => re.test(n) || re.test(full))) return true;
  return false;
}

export function isProduction(raw) {
  const n = normName(raw);
  return PRODUCTION.some((s) => n.includes(s));
}

export function isLowPriority(raw) {
  const n = cleanName(raw);
  return LOW_PRIORITY.some((re) => re.test(n) || re.test(normName(raw)));
}

export function parseDate(v) {
  if (!v) return null;
  // ArcGIS date fields arrive as epoch milliseconds (number, or numeric string).
  if (typeof v === "number" && Number.isFinite(v)) {
    return new Date(v).toISOString().slice(0, 10);
  }
  const s = String(v);
  if (/^\d{12,13}$/.test(s)) return new Date(Number(s)).toISOString().slice(0, 10);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const t = Date.parse(s);
  if (!Number.isFinite(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

export function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

export function monthsAgoIso(months) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString().slice(0, 10);
}

function betterPhone(a, b) {
  const da = (a || "").replace(/\D/g, "");
  const db = (b || "").replace(/\D/g, "");
  if (db.length > da.length) return b;
  return a || b || "";
}

export function aggregate(records, statusMap = {}) {
  const byId = new Map();
  let skippedDnc = 0;
  let skippedNoBuilder = 0;

  for (const rec of records) {
    const builder = cleanName(rec.builder);
    if (!builder) {
      skippedNoBuilder++;
      continue;
    }
    if (isDnc(builder)) {
      skippedDnc++;
      continue;
    }
    const id = slugId(builder);
    const date = parseDate(rec.date);
    let row = byId.get(id);
    if (!row) {
      const saved = statusMap[id] || {};
      row = {
        id,
        name: builder,
        counties: [],
        permitCount: 0,
        latestDate: null,
        addresses: [],
        permitNos: [],
        phone: "",
        website: "",
        email: "",
        contactName: "",
        contactTitle: "",
        sources: {},
        production: isProduction(builder),
        lowPriority: isLowPriority(builder),
        status: saved.status || "New",
        notes: saved.notes || "",
        updatedAt: saved.updatedAt || null,
      };
      byId.set(id, row);
    }
    row.permitCount++;
    if (rec.county && !row.counties.includes(rec.county)) row.counties.push(rec.county);
    if (date && (!row.latestDate || date > row.latestDate)) row.latestDate = date;
    const addr = (rec.address || "").replace(/\s+/g, " ").trim();
    if (addr && !row.addresses.includes(addr) && row.addresses.length < 5) row.addresses.push(addr);
    if (rec.permitNo && row.permitNos.length < 8) row.permitNos.push(String(rec.permitNo));
    if (rec.phone) row.phone = betterPhone(row.phone, String(rec.phone).trim());
    if (rec.website && !row.website) row.website = String(rec.website).trim();
    // Prefer a cleaner / longer official-looking name
    if (builder.length > row.name.length && !/d\/b\/a/i.test(builder)) row.name = builder;
  }

  for (const row of byId.values()) {
    const enr = ENRICHMENT[row.id];
    if (enr) {
      if (!row.phone && enr.phone) row.phone = enr.phone;
      if (enr.phoneVerified && enr.phone) row.phone = enr.phone;
      if (!row.website && enr.website) row.website = enr.website;
      if (!row.email && enr.email) row.email = enr.email;
      if (!row.contactName && enr.contactName) row.contactName = enr.contactName;
      if (!row.contactTitle && enr.contactTitle) row.contactTitle = enr.contactTitle;
      if (enr.sources) row.sources = { ...row.sources, ...enr.sources };
    }
  }

  const builders = [...byId.values()].sort((a, b) => {
    if (a.latestDate && b.latestDate && a.latestDate !== b.latestDate) return a.latestDate < b.latestDate ? 1 : -1;
    if (a.latestDate && !b.latestDate) return -1;
    if (!a.latestDate && b.latestDate) return 1;
    return b.permitCount - a.permitCount || a.name.localeCompare(b.name);
  });

  return {
    builders,
    skippedDnc,
    skippedNoBuilder,
    customCount: builders.filter((b) => !b.production).length,
    productionCount: builders.filter((b) => b.production).length,
  };
}
