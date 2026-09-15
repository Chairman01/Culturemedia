"use client";

import { useEffect } from "react";
import { X, MapPin, Phone, Mail, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CONTACT } from "@/lib/contact";

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
    // Close on Escape and stop the page behind the modal from scrolling.
    useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="contact-modal-title"
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl"
                        >
                            {/* Anchored to the modal itself so it stays top-right whether the
                                two columns sit side by side or stack on narrow screens. */}
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close contact form"
                                className="absolute right-4 top-4 z-10 rounded-full bg-white/90 p-2 text-gray-600 shadow-sm backdrop-blur transition-colors hover:bg-white hover:text-gray-900"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            <div className="grid md:grid-cols-2">
                                {/* Left — info */}
                                <div className="bg-black p-8 text-white md:p-10">
                                    <span className="inline-block rounded-full bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-black">
                                        Partner With Us
                                    </span>

                                    <h2 id="contact-modal-title" className="mt-6 text-3xl font-bold leading-tight md:text-4xl">
                                        Let&apos;s create something amazing together
                                    </h2>

                                    <p className="mt-4 leading-relaxed text-gray-300">
                                        Ready to take your brand to the next level? Contact us today to discuss how we can
                                        help you reach Alberta&apos;s most engaged audience.
                                    </p>

                                    <div className="mt-8 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                                                <MapPin className="h-4 w-4" />
                                            </span>
                                            <span className="text-sm text-gray-200">{CONTACT.locationLine}</span>
                                        </div>

                                        <a href={`tel:${CONTACT.phoneHref}`} className="flex items-center gap-3 transition-colors hover:text-white">
                                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                                                <Phone className="h-4 w-4" />
                                            </span>
                                            <span className="text-sm text-gray-200">{CONTACT.phoneDisplay}</span>
                                        </a>

                                        <a href={`mailto:${CONTACT.email}`} className="flex items-center gap-3 transition-colors hover:text-white">
                                            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/10">
                                                <Mail className="h-4 w-4" />
                                            </span>
                                            <span className="break-all text-sm text-gray-200">{CONTACT.email}</span>
                                        </a>
                                    </div>
                                </div>

                                {/* Right — form */}
                                <div className="p-8 md:p-10">
                                    <h3 className="text-2xl font-bold text-foreground">Send us a message</h3>
                                    <p className="mt-1.5 text-sm text-muted-foreground">
                                        We usually reply within one business day.
                                    </p>

                                    <form
                                        action={`https://formsubmit.co/${CONTACT.email}`}
                                        method="POST"
                                        className="mt-6 space-y-4"
                                    >
                                        {/* FormSubmit configuration */}
                                        <input type="hidden" name="_subject" value="New Partnership Inquiry from Culture Media Website" />
                                        <input type="hidden" name="_captcha" value="false" />
                                        <input type="hidden" name="_template" value="table" />

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <div>
                                                <label htmlFor="firstName" className="mb-1.5 block text-sm font-medium text-gray-700">
                                                    First name
                                                </label>
                                                <input
                                                    type="text"
                                                    id="firstName"
                                                    name="First_Name"
                                                    placeholder="John"
                                                    autoComplete="given-name"
                                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-primary"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="lastName" className="mb-1.5 block text-sm font-medium text-gray-700">
                                                    Last name
                                                </label>
                                                <input
                                                    type="text"
                                                    id="lastName"
                                                    name="Last_Name"
                                                    placeholder="Doe"
                                                    autoComplete="family-name"
                                                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-primary"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-gray-700">
                                                Email
                                            </label>
                                            <input
                                                type="email"
                                                id="email"
                                                name="Email"
                                                placeholder="john@company.com"
                                                autoComplete="email"
                                                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-primary"
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="company" className="mb-1.5 block text-sm font-medium text-gray-700">
                                                Company
                                            </label>
                                            <input
                                                type="text"
                                                id="company"
                                                name="Company"
                                                placeholder="Your company name"
                                                autoComplete="organization"
                                                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-primary"
                                            />
                                        </div>

                                        <div>
                                            <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-gray-700">
                                                Message
                                            </label>
                                            <textarea
                                                id="message"
                                                name="Message"
                                                placeholder="Tell us about your brand and what you're looking for..."
                                                rows={4}
                                                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 outline-none transition-shadow focus:border-transparent focus:ring-2 focus:ring-primary"
                                                required
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-gray-800"
                                        >
                                            Send Message
                                            <ArrowRight className="h-4 w-4" />
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
