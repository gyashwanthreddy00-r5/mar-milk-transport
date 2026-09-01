export const COMPANY = {
  name: 'MAR ENTERPRISES',
  tagline: 'ALL MATERIAL SUPPLIERS',
  email: 'mareddy5555@gmail.com',
  gstin: '36ABYFM0925B1Z7',
  cell1: '9951484494',
  cell2: '8247507026',
  addressLines: [
    'Sy No: 25, Majeedpur to Medchal Checkpost Road, Opp Essar Petrol Pump,,',
    'Majeedpur (V), MEDCHAL (M) MEDCHAL-MALKAJGIRI DIST., TELANGANA, 501401',
  ],
};

export function companyHeaderLines(): string[] {
  return [
    COMPANY.name,
    COMPANY.tagline,
    ...COMPANY.addressLines,
    `EMAIL: ${COMPANY.email}`,
    `GSTIN: ${COMPANY.gstin}  |  Cell: ${COMPANY.cell1}, ${COMPANY.cell2}`,
    '',
  ];
}
