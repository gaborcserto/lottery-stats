const pages = {
  401: {
    title: 'A hozzáférés nem engedélyezett',
    message: 'A kért tartalom jelenleg nem érhető el ezzel a hozzáféréssel.',
  },
  403: {
    title: 'A hozzáférés megtagadva',
    message: 'Ehhez a tartalomhoz jelenleg nincs hozzáférése.',
  },
  404: {
    title: 'Az oldal nem található',
    message:
      'A kért címhez nem tartozik oldal. Ellenőrizze a címet, vagy térjen vissza a főoldalra.',
  },
  400: {
    title: 'Ellenőrizze a megadott szűrőket',
    message:
      'A kérés adatai nem fogadhatók el. Módosítsa a szűrőket, majd próbálja újra.',
  },
  422: {
    title: 'Ellenőrizze a megadott szűrőket',
    message:
      'A kérés adatai nem fogadhatók el. Módosítsa a szűrőket, majd próbálja újra.',
  },
  500: {
    title: 'Váratlan hiba történt',
    message:
      'Az oldal betöltése közben hiba történt. Próbálja újra, vagy térjen vissza a főoldalra.',
  },
  503: {
    title: 'A szolgáltatás átmenetileg nem érhető el',
    message:
      'Az adatforrás jelenleg nem válaszol. Kérjük, próbálja meg később.',
  },
} as const

export function getErrorPage(status: number) {
  return pages[status as keyof typeof pages] ?? pages[500]
}

export function getErrorPageTitle(status: number): string {
  return getErrorPage(status).title
}
