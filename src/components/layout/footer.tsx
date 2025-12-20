import Link from "next/link"
import { Github, Twitter, Linkedin, Instagram, Mail, Phone, MapPin } from "lucide-react"

export function Footer() {
    return (
        <footer className="border-t border-gray-200 bg-gray-50 py-12 md:py-16 relative z-10">
            <div className="container mx-auto px-4 md:px-6">
                <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
                    <div className="space-y-4">
                        <h3 className="text-2xl font-bold text-foreground tracking-tight">CULTURE <span className="text-[#808080]">MEDIA</span></h3>
                        <p className="text-sm text-muted-foreground">
                            Your strategic partner for digital growth in Alberta and across Canada.
                        </p>
                    </div>

                    <div>
                        <h4 className="mb-4 text-sm font-semibold text-foreground uppercase tracking-wider">Services</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#services" className="hover:text-gray-900 transition-colors">Digital Growth</Link></li>
                            <li><Link href="#services" className="hover:text-gray-900 transition-colors">Web & eCommerce</Link></li>
                            <li><Link href="#services" className="hover:text-gray-900 transition-colors">Digital Strategy</Link></li>
                            <li><Link href="#services" className="hover:text-gray-900 transition-colors">Branding & Identity</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-4 text-sm font-semibold text-foreground uppercase tracking-wider">Company</h4>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li><Link href="#about" className="hover:text-gray-900 transition-colors">About Us</Link></li>
                            <li><Link href="#contact" className="hover:text-gray-900 transition-colors">Start a Partnership</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="mb-4 text-sm font-semibold text-foreground uppercase tracking-wider">Contact</h4>
                        <ul className="space-y-3 text-sm text-muted-foreground">
                            <li className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-600" />
                                <a href="mailto:culturemedia101@gmail.com" className="hover:text-gray-900 transition-colors">culturemedia101@gmail.com</a>
                            </li>
                            <li className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-600" />
                                <a href="tel:2262361828" className="hover:text-gray-900 transition-colors">226 236 1828</a>
                            </li>
                            <li className="flex items-start gap-2">
                                <MapPin className="h-4 w-4 text-gray-600 mt-0.5" />
                                <span>Calgary, Alberta<br />Canada</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-12 border-t border-gray-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
                    <div>
                        © {new Date().getFullYear()} Culture Media Group. All rights reserved.
                    </div>
                    <div className="flex gap-6">
                        <Link href="#" className="hover:text-gray-900 transition-colors">Privacy Policy</Link>
                        <Link href="#" className="hover:text-gray-900 transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </div>
        </footer>
    )
}
