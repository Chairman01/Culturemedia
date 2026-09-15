import Link from "next/link"
import { Instagram, Mail, Phone, MapPin, ArrowUpRight } from "lucide-react"
import { CONTACT } from "@/lib/contact"

export function Footer() {
    return (
        <footer className="relative z-10 border-t border-gray-200 bg-gray-50 px-4 py-16 md:px-6">
            <div className="container mx-auto">
                <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="space-y-4 sm:col-span-2 lg:col-span-1">
                        <h3 className="text-2xl font-bold tracking-tight text-foreground">
                            CULTURE <span className="text-brand">MEDIA</span>
                        </h3>
                        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
                            Your strategic partner for digital growth in Alberta and across Canada.
                        </p>
                        <div className="flex gap-2 pt-1">
                            <a
                                href={CONTACT.instagram.alberta}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Culture Alberta on Instagram"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-primary/40 hover:text-primary"
                            >
                                <Instagram className="h-4 w-4" />
                            </a>
                            <a
                                href={CONTACT.instagram.calgary}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="Culture YYC on Instagram"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-primary/40 hover:text-primary"
                            >
                                <Instagram className="h-4 w-4" />
                            </a>
                            <a
                                href={`mailto:${CONTACT.email}`}
                                aria-label={`Email ${CONTACT.email}`}
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 transition-colors hover:border-primary/40 hover:text-primary"
                            >
                                <Mail className="h-4 w-4" />
                            </a>
                        </div>
                    </div>

                    <div>
                        <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">Services</h4>
                        <ul className="space-y-2.5 text-sm text-muted-foreground">
                            <li><Link href="#services" className="transition-colors hover:text-gray-900">Digital Growth</Link></li>
                            <li><Link href="#services" className="transition-colors hover:text-gray-900">Web &amp; eCommerce</Link></li>
                            <li><Link href="#services" className="transition-colors hover:text-gray-900">Digital Strategy</Link></li>
                            <li><Link href="#services" className="transition-colors hover:text-gray-900">Branding &amp; Identity</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">Company</h4>
                        <ul className="space-y-2.5 text-sm text-muted-foreground">
                            <li><Link href="#about" className="transition-colors hover:text-gray-900">About Us</Link></li>
                            <li><Link href="#partners" className="transition-colors hover:text-gray-900">Our Partners</Link></li>
                            <li><Link href="#platforms" className="transition-colors hover:text-gray-900">Our Platforms</Link></li>
                            <li><Link href="#contact" className="transition-colors hover:text-gray-900">Start a Partnership</Link></li>
                            <li>
                                <a
                                    href={CONTACT.publication}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 transition-colors hover:text-gray-900"
                                >
                                    Culture Alberta
                                    <ArrowUpRight className="h-3 w-3" />
                                </a>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-4 text-xs font-semibold uppercase tracking-widest text-foreground">Contact</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2.5">
                                <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                                <a href={`mailto:${CONTACT.email}`} className="break-all transition-colors hover:text-gray-900">
                                    {CONTACT.email}
                                </a>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <Phone className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                                <a href={`tel:${CONTACT.phoneHref}`} className="transition-colors hover:text-gray-900">
                                    {CONTACT.phoneDisplay}
                                </a>
                            </li>
                            <li className="flex items-start gap-2.5">
                                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" />
                                <span>
                                    {CONTACT.locationLine}
                                    <br />
                                    {CONTACT.country}
                                </span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-14 border-t border-gray-200 pt-8 text-sm text-muted-foreground">
                    © {new Date().getFullYear()} Culture Media Group. All rights reserved.
                </div>
            </div>
        </footer>
    )
}
