/**
 * Single source of truth for public contact details.
 * Every surface (page, footer, modals) reads from here so the site can never
 * show two different addresses or a display number that disagrees with its
 * tel: link.
 */
export const CONTACT = {
    email: "hello@culturemedia.ca",
    /** E.164 form, used for tel: hrefs. */
    phoneHref: "+15878979347",
    /** Human-readable form, used for display. */
    phoneDisplay: "587 897 9347",
    locationLine: "Calgary & Edmonton, Alberta",
    country: "Canada",
    instagram: {
        alberta: "https://www.instagram.com/culturealberta._/",
        calgary: "https://www.instagram.com/cultureyyc._/",
    },
    publication: "https://www.culturealberta.com",
} as const;
