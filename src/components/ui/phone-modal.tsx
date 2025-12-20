"use client";

import { motion, AnimatePresence } from "framer-motion";
import { X, Phone } from "lucide-react";

interface PhoneModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function PhoneModal({ isOpen, onClose }: PhoneModalProps) {
    const phoneNumber = "2262361828";
    const formattedPhone = "226 236 1828";

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
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative"
                        >
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>

                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                                    <Phone className="w-8 h-8 text-blue-600" />
                                </div>

                                <h2 className="text-2xl font-bold mb-2">Call Us</h2>
                                <p className="text-gray-600 mb-6">
                                    Ready to discuss your project? Give us a call!
                                </p>

                                <div className="bg-gray-50 rounded-xl p-6 mb-6">
                                    <div className="text-3xl font-bold text-gray-900 mb-2">
                                        {formattedPhone}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                        Calgary, Alberta
                                    </div>
                                </div>

                                <a
                                    href={`tel:+1${phoneNumber}`}
                                    className="inline-flex items-center justify-center w-full bg-black text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                                >
                                    <Phone className="w-5 h-5 mr-2" />
                                    Call Now
                                </a>
                            </div>
                        </motion.div>
                    </div>
                </>
            )}
        </AnimatePresence>
    );
}
