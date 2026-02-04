/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            // 1. Define the Keyframes
            keyframes: {
                'slide-in-fade': {
                    '0%': { opacity: '0', transform: 'translateY(4px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
            },
            // 2. Define the Animation Utility
            animation: {
                // Usage: className="animate-stagger-item"
                'stagger-item': 'slide-in-fade 200ms ease-out forwards',
            },
        },
    },
    plugins: [],
}