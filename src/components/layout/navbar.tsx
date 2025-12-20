"use client";

"use client";

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { motion } from "framer-motion"

export function Navbar() {
    return (
        <motion.header
            initial={{ y: -100 }}
            animate={{ y: 0 }}
            className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/70 backdrop-blur-xl"
        >
            <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-6">
                <Link href="/" className="flex items-center gap-2">
                    <span className="text-2xl font-bold tracking-tighter text-foreground">
                        CULTURE <span className="text-[#808080]">MEDIA</span>
                    </span>
                </Link>

                <nav className="hidden md:flex items-center gap-8">
                    <Link href="#services" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                        Services
                    </Link>
                    <Link href="#about" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                        About
                    </Link>
                    <Link href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                        Platforms
                    </Link>
                    <Link href="#" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
                        Partner With Us
                    </Link>
                </nav>

                <div className="flex items-center gap-4">
                    <Link href="#contact">
                        <Button variant="primary" size="sm" className="hidden sm:inline-flex">
                            Start a Partnership
                        </Button>
                    </Link>
                </div>
            </div>
        </motion.header>
    )
}
