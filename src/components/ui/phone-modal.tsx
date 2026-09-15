"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Phone, Mail } from "lucide-react";
import { CONTACT } from "@/lib/contact";

interface PhoneModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PhoneModal({ isOpen, onClose }: PhoneModalProps) {
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
                            aria-labelledby="phone-modal-title"
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"
                        >
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Close"
                                className="absolute right-4 top-4 rounded-full p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
                            >
                                <X className="h-5 w-5" />
                            </button>

                            <div className="text-center">
                                <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-blue-50">
                                    <Phone className="h-7 w-7 text-primary" />
                                </span>

                                <h2 id="phone-modal-title" className="text-2xl font-bold text-foreground">
                                    Call Us
                                </h2>
                                <p className="mt-2 text-muted-foreground">
                                    Ready to discuss your project? Give us a call.
                                </p>

                                <div className="mt-6 rounded-xl bg-gray-50 p-6">
                                    <div className="text-3xl font-bold tracking-tight text-foreground">
                                        {CONTACT.phoneDisplay}
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">{CONTACT.locationLine}</div>
                                </div>

                                <a
                                    href={`tel:${CONTACT.phoneHref}`}
                                    className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-black px-6 py-3 font-medium text-white transition-colors hover:bg-gray-800"
                                >
                                    <Phone className="mr-2 h-5 w-5" />
                                    Call Now
                                </a>

                                <a
                                    href={`mailto:${CONTACT.email}`}
                                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
                                >
                                    <Mail className="mr-2 h-5 w-5" />
                                    Email Instead
                                </a>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
