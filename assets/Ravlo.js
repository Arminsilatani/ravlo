/*
 ****************************************************
 *  Author: Armin Silatani
 *  Date: 2026-06-18
 *  Version: 3.2.9
 ****************************************************
 */

/* =========================== RAVLO CALENDAR APP ============================ */

/* :::::::::::::::::::::::::: SUPABASE CLIENT :::::::::::::::::::::::::: */
const SUPABASE_URL = 'https://vzqicidepdmraygulrey.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kqRWgOmLISOE2EuLL1s8fw_WN6FJRTI';
const {
    createClient
} = supabase;
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* :::::::::::::::::::::::::: GLOBAL STATE :::::::::::::::::::::::::: */
let currentLocationAddress = null;
let currentUser = null;
let currentUserRole = 'public';
let currentProfile = null;
let locationMap = null;
let locationMarker = null;
let currentLocationCoords = null;
let currentLocationName = '';
let isLocationActive = false;
let currentInvitees = [];
let recurrence = {
    type: 'none',
    interval: 1,
    days: [],
    smartInterval: 'weekly'
};

let viewMode = localStorage.getItem('ravlo-view-mode') || 'month';
if (viewMode === 'week') {
    localStorage.setItem('ravlo-view-mode', 'day');
}
let currentDate = new Date();
let events = [];
let eventType = 'event';
let selectedTagColor = '#f5f5f5';
let currentChecklistItems = [];
let selectedIcon = null;
let titlePickerActive = false;
let editingEventId = null;
window.__lastMonthYearText = '';

/* :::::::::::::::::::::::::: DOM REFERENCES :::::::::::::::::::::::::: */
const authOverlay = document.getElementById('auth-overlay');
const appContainer = document.getElementById('app-container');
const authError = document.getElementById('auth-error');
const eventDetailModal = document.getElementById('event-detail-modal');
const eventDetailTitle = document.getElementById('event-detail-title');
const eventDetailDate = document.getElementById('event-detail-date');
const eventDetailAllDay = document.getElementById('event-detail-all-day');
let currentDetailEventId = null;

const calendarGrid = document.getElementById('calendar-grid');
const currentMonthYearEl = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const addEventBtn = document.getElementById('sidebar-new-event');
const eventModal = document.getElementById('event-modal');
const closeModalBtns = document.querySelectorAll('#event-modal .close-modal');
const saveEventBtn = document.getElementById('save-event');
const eventTitleInput = document.getElementById('event-title');
const eventStartInput = document.getElementById('event-start');
const eventEndInput = document.getElementById('event-end');
const eventAllDayCheck = document.getElementById('event-all-day');
const viewTabsEl = document.getElementById('view-tabs');
const currentMonthYearBtn = document.getElementById('current-month-year-btn');

const eventDetailConfirm = document.getElementById('event-detail-confirm');
const confirmYesBtn = document.getElementById('confirm-yes');
const confirmNoBtn = document.getElementById('confirm-no');

const tabIndicator = document.createElement('div');
tabIndicator.className = 'indicator';
if (viewTabsEl) viewTabsEl.appendChild(tabIndicator);

// Gregorian picker DOM references
const gregPickerPopup = document.getElementById('greg-picker-popup');
const gregPickerTrigger = document.getElementById('greg-picker-trigger');
const gregTriggerText = document.getElementById('greg-trigger-text');
const gregDaysEl = document.getElementById('greg-days');
const gregPrevBtn = document.getElementById('greg-prev');
const gregNextBtn = document.getElementById('greg-next');
const gregHourInput = document.getElementById('greg-hour');
const gregMinuteInput = document.getElementById('greg-minute');
const gregConfirmBtn = document.getElementById('greg-confirm');
const gregDateRow = document.getElementById('greg-date-row');
const eventStartGreg = document.getElementById('event-start-greg');
const gregMonthBtn = document.getElementById('greg-month-btn');
const gregYearBtn = document.getElementById('greg-year-btn');
const gregMonthPopup = document.getElementById('greg-month-popup');
const gregYearPopup = document.getElementById('greg-year-popup');
const gregYearPanel = document.getElementById('greg-year-panel');

// Additional picker state
var gregState = {
    gy: 2026,
    gm: 0,
    selectedGd: null
};
var GREG_MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
var currentDetailEvent = null;
/* :::::::::::::::::::::::::: LAZY PIN ICON :::::::::::::::::::::::::: */
let accentPinIcon = null;

function getAccentPinIcon() {
    if (!accentPinIcon) {
        if (typeof L === 'undefined') return null;
        accentPinIcon = L.divIcon({
            className: 'custom-pin',
            html: `<svg width="30" height="40" viewBox="0 0 24 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C5.372 0 0 5.372 0 12c0 7.028 12 24 12 24s12-16.972 12-24C24 5.372 18.628 0 12 0zm0 16a4 4 0 110-8 4 4 0 010 8z"
                      fill="currentColor" stroke="#fff" stroke-width="1.5"/>
            </svg>`,
            iconSize: [30, 40],
            iconAnchor: [15, 40],
            popupAnchor: [0, -40]
        });
    }
    return accentPinIcon;
}

/* =========================== UTILITY FUNCTIONS ============================ */

const DASHBOARD_URL = 'https://arminsilatani.github.io/dashboard/';

async function addNotificationToUser(userId, type, title, body, link) {
    try {
        await sb.from('notifications').insert({
            user_id: userId,
            type,
            title,
            body,
            link
        });
    } catch (e) {
        console.warn('Notification failed:', e);
    }
}

function pad(n) {
    return String(n).padStart(2, '0');
}

function isGregDatePast(gy, gm, gd) {
    const today = new Date();
    const todayGy = today.getFullYear();
    const todayGm = today.getMonth();
    const todayGd = today.getDate();
    if (gy < todayGy) return true;
    if (gy === todayGy && gm < todayGm) return true;
    if (gy === todayGy && gm === todayGm && gd < todayGd) return true;
    return false;
}

function getTextWidth(text, font) {
    const canvas = getTextWidth.canvas || (getTextWidth.canvas = document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    ctx.font = font;
    return ctx.measureText(text).width;
}

function animateMonthYearChange(newText) {
    const el = document.getElementById('current-month-year');
    if (!el) return;
    gsap.to(el, {
        opacity: 0,
        y: -8,
        duration: 0.15,
        onComplete: () => {
            el.textContent = newText;
            gsap.fromTo(el, {
                opacity: 0,
                y: 8
            }, {
                opacity: 1,
                y: 0,
                duration: 0.2,
                ease: 'power2.out'
            });
        }
    });
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateInviteCode() {
    return 'RAV-' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function generateInviteLinkForNewUser() {
    return `${DASHBOARD_URL}?ref=${currentUser.id}`;
}

const ICON_OPTIONS = [{
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0M3.124 7.5A8.969 8.969 0 0 1 5.292 3m13.416 0a8.969 8.969 0 0 1 2.168 4.5"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0M12 12.75h.008v.008H12v-.008Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8.25v-1.5m0 1.5c-1.355 0-2.697.056-4.024.166C6.845 8.51 6 9.473 6 10.608v2.513m6-4.871c1.355 0 2.697.056 4.024.166C17.155 8.51 18 9.473 18 10.608v2.513M15 8.25v-1.5m-6 1.5v-1.5m12 9.75-1.5.75a3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0 3.354 3.354 0 0 0-3 0 3.354 3.354 0 0 1-3 0L3 16.5m15-3.379a48.474 48.474 0 0 0-6-.371c-2.032 0-4.034.126-6 .371m12 0c.39.049.777.102 1.163.16 1.07.16 1.837 1.094 1.837 2.175v5.169c0 .621-.504 1.125-1.125 1.125H4.125A1.125 1.125 0 0 1 3 20.625v-5.17c0-1.08.768-2.014 1.837-2.174A47.78 47.78 0 0 1 6 13.12M12.265 3.11a.375.375 0 1 1-.53 0L12 2.845l.265.265Zm-3 0a.375.375 0 1 1-.53 0L9 2.845l.265.265Zm6 0a.375.375 0 1 1-.53 0L15 2.845l.265.265Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M21 11.25v8.25a1.5 1.5 0 0 1-1.5 1.5H5.25a1.5 1.5 0 0 1-1.5-1.5v-8.25M12 4.875A2.625 2.625 0 1 0 9.375 7.5H12m0-2.625V7.5m0-2.625A2.625 2.625 0 1 1 14.625 7.5H12m0 0V21m-8.625-9.75h18c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125h-18c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m9 9 10.5-3m0 6.553v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 1 1-.99-3.467l2.31-.66a2.25 2.25 0 0 0 1.632-2.163Zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 0 1-1.632 2.163l-1.32.377a1.803 1.803 0 0 1-.99-3.467l2.31-.66A2.25 2.25 0 0 0 9 15.553Z"/></svg>`
    },
    {
        svg: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5"/></svg>`
    }
];

/* ------------------------- INVITE LIST RENDERING ------------------------- */
function renderInviteModalList() {
    const list = document.getElementById('invite-list');
    if (!list) return;
    list.innerHTML = currentInvitees.map(name => `<li><span>${name}</span></li>`).join('');
}

/* ------------------------- CHECKLIST MODAL RENDERING ------------------------- */
let tempChecklistItems = [];

function renderChecklistModalItems() {
    const container = document.getElementById('checklist-modal-items');
    if (!container) return;
    container.innerHTML = tempChecklistItems.map((item, i) => `
        <div class="checklist-item">
            <input type="checkbox" class="neon-checkbox" ${item.done ? 'checked' : ''} data-index="${i}">
            <span contenteditable="true" class="checklist-text" data-index="${i}">${item.text}</span>
        </div>
    `).join('');

    container.querySelectorAll('.neon-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
            const idx = parseInt(this.dataset.index);
            tempChecklistItems[idx].done = this.checked;
        });
    });
    container.querySelectorAll('.checklist-text').forEach(span => {
        span.addEventListener('input', function() {
            const idx = parseInt(this.dataset.index);
            tempChecklistItems[idx].text = this.textContent.trim();
        });
    });
    container.querySelectorAll('.remove-checklist-item').forEach(btn => {
        btn.addEventListener('click', function() {
            const idx = parseInt(this.dataset.index);
            tempChecklistItems.splice(idx, 1);
            renderChecklistModalItems();
        });
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'ravlo-toast';

    // SVG ring
    const r = 10;
    const circumference = 2 * Math.PI * r;

    toast.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" class="toast-ring">
            <circle cx="12" cy="12" r="${r}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
            <circle cx="12" cy="12" r="${r}" fill="none" stroke="#fff" stroke-width="2"
                    stroke-dasharray="${circumference}" stroke-dashoffset="0"
                    stroke-linecap="round"
                    style="transition: stroke-dashoffset 4s linear;"/>
        </svg>
        <span>${message}</span>
    `;

    document.body.appendChild(toast);

    // Start ring animation after a tiny delay to ensure transition triggers
    requestAnimationFrame(() => {
        const ring = toast.querySelector('.toast-ring circle:last-child');
        if (ring) ring.style.strokeDashoffset = circumference;
    });

    // Remove after 4 seconds
    setTimeout(() => toast.remove(), 4000);
}

/* =========================== HOLIDAYS ============================ */
const GREG_HOLIDAYS = {
    '01-01': "New Year's Day",
    '02-14': "Valentine's Day",
    '03-08': "Int'l Women's Day",
    '03-20': "Int'l Day of Happiness",
    '03-21': "Nowruz (Spring Equinox)",
    '04-01': "April Fools' Day",
    '04-22': "Earth Day",
    '05-01': "International Workers' Day",
    '06-05': "World Environment Day",
    '06-21': "World Music Day",
    '07-04': "US Independence Day",
    '08-12': "Int'l Youth Day",
    '09-21': "Int'l Day of Peace",
    '10-31': "Halloween",
    '11-11': "Veterans Day",
    '12-10': "Human Rights Day",
    '12-25': "Christmas Day",
    '12-31': "New Year's Eve"
};

function getGregHoliday(year, month, day) {
    return GREG_HOLIDAYS[pad(month + 1) + '-' + pad(day)] || null;
}

/* =========================== SVG ICONS ============================ */
const ICON_CALENDAR = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';
const ICON_SMILE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>';
const ICON_EDIT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>';
const ICON_TRASH = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';

/* =========================== PROFILE & AUTH ============================ */

/* ------------------------- PROFILE BUILDER ------------------------- */
async function buildCurrentProfile(user) {
    if (!user) return null;
    const {
        data: profileRow,
        error
    } = await sb
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.warn('Profile fetch warning:', error.message);
    }

    const md = user.user_metadata || {};
    const p = profileRow || {};

    return {
        id: user.id,
        first_name: p.first_name ?? md.first_name ?? md.given_name ?? '',
        last_name: p.last_name ?? md.last_name ?? md.family_name ?? '',
        photo_url: p.photo_url ?? md.photo_url ?? md.picture ?? '',
        username: p.username ?? md.username ?? '',
        role: p.role ?? md.role ?? 'recruit'
    };
}

/* ------------------------- ROLE HIERARCHY & ACCESS ------------------------- */
const ROLE_HIERARCHY = ['recruit', 'sergeant', 'commander', 'general'];

function normalizeRole(role) {
    return String(role || '').trim().toLowerCase();
}

function hasAccess(userRole, minRole) {
    const normalizedUserRole = normalizeRole(userRole);
    const normalizedMinRole = normalizeRole(minRole || 'recruit');

    const userIndex = ROLE_HIERARCHY.indexOf(normalizedUserRole);
    const minIndex = ROLE_HIERARCHY.indexOf(normalizedMinRole);

    if (minIndex === -1) {
        console.warn('[RBAC] Invalid minRole:', minRole);
        return false;
    }

    if (userIndex === -1) return false;

    return userIndex >= minIndex;
}

/* =========================== SIDEBAR MENU & TODAY LIST ============================ */

const MENU_TOOLS = [{
        label: 'Codara Service Generator',
        minRole: 'general',
        link: 'https://codara.arminsilatani.com/',
        iconURL: 'assets/logos/Co.svg'
    },
    {
        label: 'Nolvo Sitemap Builder',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/No.svg'
    },
    {
        label: 'Qerlo Shortener',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Qe.svg'
    },
    {
        label: 'Tivra Minify',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Ti.svg'
    },
    {
        label: 'Semora Schema Generator',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Se.svg'
    },
    {
        label: 'Brilo Speed Check',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Br.svg'
    },
    {
        label: 'Sorbi Robots Builder',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/So.svg'
    },
    {
        label: 'Velto Meta Inspector',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Ve.svg'
    },
    {
        label: 'Zorio Image Converter',
        minRole: 'recruit',
        link: 'https://zorio.arminsilatani.com/',
        iconURL: 'assets/logos/Zo.svg'
    },
    {
        label: 'Galvo Video Converter',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Ga.svg'
    },
    {
        label: 'Xelpo Pass Generator',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Xe.svg'
    },
    {
        label: 'Dirmo DNS Checker',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Di.svg'
    },
    {
        label: 'Lemro Keyword Research',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Le.svg'
    },
    {
        label: 'Hirvo Density',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Hi.svg'
    },
    {
        label: 'Jorvi Redirect',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Jo.svg'
    },
    {
        label: 'Mirto CRM',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Mi.svg'
    },
    {
        label: 'Ravlo Calendar',
        minRole: 'sergeant',
        link: '',
        iconURL: 'assets/logos/Ra.svg',
        isSelf: true
    },
    {
        label: 'Rinvo Accounting',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Ri.svg'
    },
    {
        label: 'Yelmo Brand Namer',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Ye.svg'
    },
    {
        label: 'Cedro Flashcards',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Ce.svg'
    },
    {
        label: 'Fresca Colors Tool',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Fr.svg'
    },
    {
        label: 'Ubiro Beer Cost',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Ub.svg'
    },
    {
        label: 'Refacto Code Beautifier',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Re.svg'
    },
    {
        label: 'Pilvo Text Editor',
        minRole: 'recruit',
        link: 'https://pilvo.arminsilatani.com/',
        iconURL: 'assets/logos/Pi.svg'
    },
    {
        label: 'Tavio Prompt Library',
        minRole: 'recruit',
        link: 'https://tavio.arminsilatani.com/',
        iconURL: 'assets/logos/Ta.svg'
    },
    {
        label: 'Falco Favicon Generator',
        minRole: 'recruit',
        link: 'https://falco.arminsilatani.com/',
        iconURL: 'assets/logos/Fa.svg'
    },
    {
        label: 'Lume Epoch Converter',
        minRole: 'recruit',
        link: 'https://lume.arminsilatani.com/',
        iconURL: 'assets/logos/Lu.svg'
    },
    {
        label: 'Valeno Expiry Date Reminder',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Va.svg'
    },
    {
        label: 'Alviano Recipe Manager',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Al.svg'
    },
    {
        label: 'Mavero Workout Tracker',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Ma.svg'
    },
    {
        label: 'Tempozio Time Tracker',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Te.svg'
    },
    {
        label: 'Belluno Wishlist',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Be.svg'
    },
    {
        label: 'Nuvello Wallpaper App',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Nu.svg'
    },
    {
        label: 'Fiora Period Tracker',
        minRole: 'general',
        link: '',
        iconURL: 'assets/logos/Fi.svg'
    },
];

function renderSidebarMenu() {
    const container = document.getElementById('sidebar-menu-items');
    const newEventBtn = document.getElementById('sidebar-new-event');
    if (newEventBtn) newEventBtn.classList.remove('hidden');
    if (!container) return;

    container.innerHTML = '';

    const role = normalizeRole(currentUserRole);

    MENU_TOOLS.forEach(tool => {
        if (tool.isSelf) return;

        const allowed = hasAccess(role, tool.minRole);

        const btn = document.createElement('button');
        btn.className = 'sidebar-item' + (allowed ? '' : ' disabled');
        btn.disabled = !allowed;

        btn.innerHTML = `
            <span class="sidebar-icon">
                <img src="${tool.iconURL}" width="20" height="20" alt="${tool.label}">
            </span>
            <span>${tool.label}</span>
            ${!tool.link ? '<span class="coming-soon-tooltip">Coming Soon</span>' : ''}
        `;

        btn.addEventListener('click', () => {
            if (!currentUser) {
                openModal(authOverlay);
                authError.textContent = 'Please sign in to use this tool.';
                return;
            }
            const canUseNow = hasAccess(currentUserRole, tool.minRole);
            if (!canUseNow) {
                alert('Your access level is too low to use this tool.');
                return;
            }
            if (tool.link) {
                window.open(tool.link, '_blank');
            }
            const closeRow = document.getElementById('sidebar-close-row');
            if (closeRow) closeRow.click();
        });

        container.appendChild(btn);
    });
}

function updateDashboardLink() {
    const dashboard = document.getElementById('sidebar-dashboard');
    if (!dashboard) return;

    if (!currentProfile) {
        dashboard.classList.add('hidden');
        return;
    }

    dashboard.classList.remove('hidden');

    const iconSpan = dashboard.querySelector('.sidebar-icon');
    const textSpan = dashboard.querySelector('.sidebar-dashboard-text') || dashboard.querySelector('span:last-child');

    const fullName = [currentProfile.first_name, currentProfile.last_name]
        .filter(Boolean)
        .join(' ') || 'Dashboard';

    if (textSpan) textSpan.textContent = fullName;

    const avatarContent = iconSpan?.querySelector('.avatar-content');
    if (avatarContent) {
        if (currentProfile.photo_url) {
            avatarContent.innerHTML = `<img src="${currentProfile.photo_url}" alt="Profile"
                width="20" height="20"
                style="border-radius:50%; object-fit:cover;"
                onerror="this.outerHTML='<span class=\\'avatar-initial\\'>${fullName.charAt(0)}</span>';">`;
        } else {
            const initial = fullName.charAt(0).toUpperCase();
            avatarContent.innerHTML = `<span class="avatar-initial">${initial}</span>`;
        }
    }
}

function updateAuthUI() {
    const loginBtn = document.getElementById('sidebar-login');
    const logoutBtn = document.getElementById('sidebar-logout');
    if (!loginBtn || !logoutBtn) return;
    if (currentUser) {
        loginBtn.classList.add('hidden');
        logoutBtn.classList.remove('hidden');
    } else {
        loginBtn.classList.remove('hidden');
        logoutBtn.classList.add('hidden');
    }
    renderSidebarMenu();
    updateDashboardLink();
    renderTodayList();
    setTimeout(async () => {
        await updateNotificationDot();
    }, 300);
}

function renderTodayList() {
    const container = document.getElementById('sidebar-today-list');
    if (!container) return;

    if (!currentUser || events.length === 0) {
        container.innerHTML = '';
        return;
    }

    const today = new Date();
    const ty = today.getFullYear(),
        tm = today.getMonth(),
        td = today.getDate();

    const todayEvents = events.filter(ev => {
        if (!ev.start_date) return false;
        const d = new Date(ev.start_date);
        if (d.getFullYear() === ty && d.getMonth() === tm && d.getDate() === td) return true;
        if (ev.recurrence_type !== 'none') {
            const dayStart = new Date(ty, tm, td, 0, 0, 0);
            const dayEnd = new Date(ty, tm, td, 23, 59, 59);
            const recDates = getRecurrenceDates(ev, dayStart, dayEnd);
            return recDates.some(rd => rd.getFullYear() === ty && rd.getMonth() === tm && rd.getDate() === td);
        }
        return false;
    });

    todayEvents.sort((a, b) => {
        const at = a.start_date ? new Date(a.start_date).getTime() : 0;
        const bt = b.start_date ? new Date(b.start_date).getTime() : 0;
        return at - bt;
    });

    if (todayEvents.length === 0) {
        container.innerHTML = '';
        return;
    }

    container.innerHTML = todayEvents.map(ev => {
        const color = ev.color || 'var(--accent)';
        return `
            <div class="sidebar-today-item" data-event-id="${ev.id}">
                <span class="dot" style="background:${color}"></span>
                <span class="title">${ev.title || 'Untitled'}</span>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.sidebar-today-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = item.dataset.eventId;
            const event = events.find(e => e.id === id);
            if (event) {
                const closeRow = document.getElementById('sidebar-close-row');
                if (closeRow) closeRow.click();
                openEventDetail(event, new Date());
            }
        });
    });
}

async function updateNotificationDot() {
    const dot = document.getElementById('avatar-notif-dot');
    if (!dot) return;
    if (!currentUser) {
        dot.style.display = 'none';
        return;
    }

    try {
        const {
            data,
            error
        } = await sb
            .from('notifications')
            .select('id')
            .eq('user_id', currentUser.id)
            .eq('is_read', false);

        if (error) throw error;

        if (data && data.length > 0) {
            dot.style.display = 'block';
            return;
        }
    } catch (e) {
        console.warn('Could not fetch notifications:', e);
    }

    const today = new Date();
    const ty = today.getFullYear(),
        tm = today.getMonth(),
        td = today.getDate();
    const hasTodayEvents = events.some(ev => {
        if (!ev.start_date) return false;
        const d = new Date(ev.start_date);
        if (d.getFullYear() === ty && d.getMonth() === tm && d.getDate() === td) return true;
        if (ev.recurrence_type !== 'none') {
            const dayStart = new Date(ty, tm, td, 0, 0, 0);
            const dayEnd = new Date(ty, tm, td, 23, 59, 59);
            const recDates = getRecurrenceDates(ev, dayStart, dayEnd);
            return recDates.some(rd => rd.getFullYear() === ty && rd.getMonth() === tm && rd.getDate() === td);
        }
        return false;
    });
    dot.style.display = hasTodayEvents ? 'block' : 'none';
}

/* =========================== MODAL HELPERS ============================ */

function openModal(modal) {
    if (!modal) return;
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
}

function closeModal(modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
}

/* ------------------------- LOADER HELPERS ------------------------- */
function getLoaderHTML(type) {
    switch (type) {
        case 'dots':
            return `<div class="ravlo-loader" data-loader="dots"><span></span><span></span><span></span></div>`;
        case 'bar':
            return `<div class="ravlo-loader" data-loader="bar"><div></div></div>`;
        case 'grid':
            return `<div class="lds-grid">${Array(9).fill('<div></div>').join('')}</div>`;
        default:
            return `<div class="ravlo-loader" data-loader="spinner"></div>`;
    }
}

function showLoader(container, type = 'spinner') {
    let target;
    if (typeof container === 'string') {
        target = document.getElementById(container);
    } else if (container instanceof HTMLElement) {
        target = container;
    } else {
        target = document.body;
        const overlay = document.createElement('div');
        overlay.id = 'ravlo-global-loader';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
        overlay.innerHTML = getLoaderHTML(type);
        target.appendChild(overlay);
        return;
    }

    target.classList.add('ravlo-loading-container');
    target.style.position = target.style.position || 'relative';
    target.innerHTML = getLoaderHTML(type);
}

function hideLoader(container) {
    if (!container) {
        const globalLoader = document.getElementById('ravlo-global-loader');
        if (globalLoader) globalLoader.remove();
        return;
    }
    let target = typeof container === 'string' ? document.getElementById(container) : container;
    if (target) {
        target.classList.remove('ravlo-loading-container');
        target.style.position = '';
        const loader = target.querySelector('.ravlo-loader, .lds-grid');
        if (loader) loader.remove();
    }
}

function showGlobalLoader() {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.classList.remove('hidden');
}

function hideGlobalLoader() {
    const loader = document.getElementById('initial-loader');
    if (loader) loader.classList.add('hidden');
}

function showConfirmModal(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-modal-message');
    if (!modal || !msgEl) return;

    msgEl.textContent = message;
    openModal(modal);

    const yesBtn = document.getElementById('confirm-modal-yes');
    const noBtn = document.getElementById('confirm-modal-no');

    function cleanup() {
        closeModal(modal);
        yesBtn.removeEventListener('click', handleYes);
        noBtn.removeEventListener('click', handleNo);
    }

    function handleYes() {
        cleanup();
        if (typeof onConfirm === 'function') onConfirm();
    }

    function handleNo() {
        cleanup();
    }

    yesBtn.addEventListener('click', handleYes);
    noBtn.addEventListener('click', handleNo);

    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            cleanup();
        }
    });
}

/* =========================== DATABASE HELPERS ============================ */

async function fetchEvents() {
    if (!currentUser) return [];
    const { data, error } = await sb
        .from('ravlo')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('start_date', { ascending: true });
    if (error) { console.warn('Fetch error:', error.message); return []; }
    return data || [];
}

async function saveEventToDB(payload) {
    if (!currentUser) {
        alert('Not logged in');
        return null;
    }
    payload.user_id = currentUser.id;
    const {
        data,
        error
    } = await sb.from('ravlo').insert([payload]).select();
    if (error) {
        alert('Save failed: ' + error.message);
        return null;
    }
    return data?.[0];
}

async function updateEventInDB(id, payload) {
    if (!currentUser) {
        alert('Not logged in');
        return null;
    }
    const {
        error
    } = await sb.from('ravlo').update(payload).eq('id', id).eq('user_id', currentUser.id);
    if (error) {
        alert('Update failed: ' + error.message);
        return null;
    }
    return true;
}

async function deleteEventFromDB(id) {
    if (!currentUser) {
        alert('Not logged in');
        return;
    }
    const {
        error
    } = await sb.from('ravlo').delete().eq('id', id).eq('user_id', currentUser.id);
    if (error) alert('Delete failed: ' + error.message);
    return !error;
}

/* =========================== AUTH FLOW ============================ */

async function showApp() {
    showGlobalLoader();
    closeModal(authOverlay);
    appContainer.style.display = 'block';

    if (currentUser) {
        events = await fetchEvents();
        await cleanupOldCompletions();
    }
    renderCalendar();
    animateTabIndicator();
    renderTodayList();
    updateNotificationDot();
    hideGlobalLoader();
    await updateNotificationDot();
}

async function logout() {
    showGlobalLoader();
    await sb.auth.signOut();
    currentUser = null;
    currentUserRole = 'public';
    currentProfile = null;
    events = [];
    renderCalendar();
    updateAuthUI();
    closeModal(eventModal);
    closeModal(eventDetailModal);
    hideGlobalLoader();
}

/* =========================== LEAFLET MAP HELPERS ============================ */

function isLeafletReady() {
    return typeof L !== 'undefined';
}

function initLocationMap(containerId = 'location-map') {
    if (!isLeafletReady()) return;
    if (locationMap) {
        locationMap.remove();
        locationMap = null;
    }
    const mapDiv = document.getElementById(containerId);
    if (!mapDiv) return;
    locationMap = L.map(containerId, {
        center: [48.85, 2.35],
        zoom: 13,
        attributionControl: false
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
    }).addTo(locationMap);

    locationMap.on('click', function(e) {
        if (locationMarker) locationMap.removeLayer(locationMarker);
        const icon = getAccentPinIcon();
        locationMarker = icon ? L.marker(e.latlng, {
            icon
        }).addTo(locationMap) : L.marker(e.latlng).addTo(locationMap);
        const lat = e.latlng.lat.toFixed(6);
        const lng = e.latlng.lng.toFixed(6);
        const coordsInput = document.getElementById('location-modal-coords-input') || document.getElementById('location-coords-input');
        if (coordsInput) coordsInput.value = lat + ', ' + lng;
        const searchInput = document.getElementById('location-search-input');
        const infoEl = document.getElementById('selected-location-info');
        if (searchInput) searchInput.value = '';
        if (infoEl) infoEl.textContent = `Selected location: ${lat}, ${lng}`;
        currentLocationCoords = {
            lat: parseFloat(lat),
            lng: parseFloat(lng)
        };
        currentLocationName = '';
    });
}

function updateMapFromCoords(lat, lng) {
    if (!isLeafletReady()) return;
    if (!locationMap) initLocationMap();
    if (locationMarker) locationMap.removeLayer(locationMarker);
    const icon = getAccentPinIcon();
    locationMarker = icon ? L.marker([lat, lng], {
        icon
    }).addTo(locationMap) : L.marker([lat, lng]).addTo(locationMap);
    locationMap.setView([lat, lng], 15);
}

function parseCoordinates(str) {
    if (!str) return null;
    const parts = str.split(/[,\s]+/).map(Number);
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        return {
            lat: parts[0],
            lng: parts[1]
        };
    }
    return null;
}

/* =========================== RECURRENCE LOGIC ============================ */

function updateRecurrencePreview() {
    const preview = document.getElementById('recurrence-preview');
    if (!preview) return;

    if (recurrence.type === 'none') {
        preview.textContent = 'Does not repeat';
        return;
    }

    const labels = {
        daily: 'Daily',
        weekly: 'Weekly',
        monthly: 'Monthly',
        yearly: 'Yearly',
        custom: 'Custom'
    };

    let text = labels[recurrence.type] || recurrence.type;
    if (recurrence.interval > 1) text += ' (every ' + recurrence.interval + ')';

    if ((recurrence.type === 'weekly' || recurrence.type === 'custom') && recurrence.days.length > 0) {
        const dayMap = {
            0: 'Su',
            1: 'Mo',
            2: 'Tu',
            3: 'We',
            4: 'Th',
            5: 'Fr',
            6: 'Sa'
        };
        const dayNames = recurrence.days.map(d => dayMap[d]);
        text += ' on ' + dayNames.join(', ');
    }

    preview.textContent = text;
}

function openRecurrenceModal() {
    const modal = document.getElementById('recurrence-modal');
    if (!modal) return;

    const smartOption = document.getElementById('smart-option');
    if (smartOption) {
        smartOption.style.display = (eventType === 'task') ? 'block' : 'none';
    }

    document.getElementById('recurrence-select').value = recurrence.type;
    if (recurrence.type === 'smart') {
        const radio = document.querySelector(`input[name="smartInterval"][value="${recurrence.smartInterval}"]`);
        if (radio) radio.checked = true;
    }
    const intervalDisplay = document.getElementById('recurrence-interval-display');
    if (intervalDisplay) intervalDisplay.textContent = recurrence.interval;
    renderRecurrenceDays();
    updateRecurrenceModalUI();
    openModal(modal);
}

function updateRecurrenceModalUI() {
    const type = document.getElementById('recurrence-select').value;
    const intervalRow = document.getElementById('rec-interval-row');
    const daysRow = document.getElementById('rec-days-row');
    const intervalLabel = document.getElementById('rec-interval-label');
    const smartOptions = document.getElementById('smart-options');

    const showDays = (type === 'weekly' || type === 'custom');
    const showInterval = (type !== 'none' && type !== 'smart');
    const showSmart = (type === 'smart');

    intervalRow.style.display = showInterval ? 'flex' : 'none';
    daysRow.style.display = showDays ? 'block' : 'none';
    if (smartOptions) smartOptions.style.display = showSmart ? 'block' : 'none';

    if (showInterval && intervalLabel) {
        const map = {
            daily: 'day(s)',
            weekly: 'week(s)',
            monthly: 'month(s)',
            yearly: 'year(s)',
            custom: 'week(s)'
        };
        intervalLabel.textContent = map[type] || '';
    }

    if (showDays) renderRecurrenceDays();
}

function renderRecurrenceDays() {
    const container = document.getElementById('rec-days-container');
    if (!container) return;

    const daysOfWeek = [{
            label: 'Su',
            value: 0
        }, {
            label: 'Mo',
            value: 1
        }, {
            label: 'Tu',
            value: 2
        },
        {
            label: 'We',
            value: 3
        }, {
            label: 'Th',
            value: 4
        }, {
            label: 'Fr',
            value: 5
        }, {
            label: 'Sa',
            value: 6
        }
    ];

    container.innerHTML = '';
    daysOfWeek.forEach(day => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'rec-day-btn';
        btn.textContent = day.label;
        if (recurrence.days.includes(day.value)) btn.classList.add('selected');
        btn.addEventListener('click', () => {
            btn.classList.toggle('selected');
            recurrence.days = Array.from(container.querySelectorAll('.rec-day-btn.selected'))
                .map(b => {
                    const idx = daysOfWeek.findIndex(d => d.label === b.textContent);
                    return daysOfWeek[idx].value;
                });
        });
        container.appendChild(btn);
    });
}

function findBestSlot(periodStart, periodEnd, events) {
    const dayEventCount = {};
    const hourEventCount = {};

    for (let d = new Date(periodStart); d <= periodEnd; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dayEventCount[dateStr] = 0;
        for (let h = 10; h < 18; h++) {
            hourEventCount[`${dateStr}-${h}`] = 0;
        }
    }

    events.forEach(ev => {
        if (!ev.start_date) return;
        const start = new Date(ev.start_date);
        if (start >= periodStart && start <= periodEnd) {
            const dateStr = start.toISOString().split('T')[0];
            if (dayEventCount[dateStr] !== undefined) dayEventCount[dateStr]++;
            const hourKey = `${dateStr}-${start.getHours()}`;
            if (hourEventCount[hourKey] !== undefined) hourEventCount[hourKey]++;
        }
        if (ev.recurrence_type !== 'none') {
            const recDates = getRecurrenceDates(ev, periodStart, periodEnd);
            recDates.forEach(rd => {
                const dateStr = rd.toISOString().split('T')[0];
                if (dayEventCount[dateStr] !== undefined) dayEventCount[dateStr]++;
                const hourKey = `${dateStr}-${rd.getHours()}`;
                if (hourEventCount[hourKey] !== undefined) hourEventCount[hourKey]++;
            });
        }
    });

    let minDayCount = Infinity;
    let bestDays = [];
    for (let dateStr in dayEventCount) {
        const count = dayEventCount[dateStr];
        if (count < minDayCount) {
            minDayCount = count;
            bestDays = [dateStr];
        } else if (count === minDayCount) {
            bestDays.push(dateStr);
        }
    }
    const chosenDay = bestDays[Math.floor(Math.random() * bestDays.length)];

    let minHourCount = Infinity;
    let bestHours = [];
    for (let h = 10; h < 18; h++) {
        const key = `${chosenDay}-${h}`;
        const count = hourEventCount[key];
        if (count < minHourCount) {
            minHourCount = count;
            bestHours = [h];
        } else if (count === minHourCount) {
            bestHours.push(h);
        }
    }
    const chosenHour = bestHours[Math.floor(Math.random() * bestHours.length)];

    return {
        date: new Date(chosenDay + 'T00:00:00'),
        hour: chosenHour,
        minute: 0
    };
}

function getRecurrenceDates(ev, fromDate, toDate) {
    if (!ev.start_date || ev.recurrence_type === 'none') return [];

    const start = new Date(ev.start_date);
    const type = ev.recurrence_type;
    const interval = ev.recurrence_interval || 1;
    const days = ev.recurrence_days || [];
    const smartInterval = ev.recurrence_smart_interval || 'weekly';
    const occurrences = [];

    const maxDate = new Date(start);
    maxDate.setFullYear(maxDate.getFullYear() + 2);

    let current = new Date(start);
    const end = toDate > maxDate ? maxDate : toDate;

    while (current <= end) {
        if (current >= fromDate && current >= start) {
            occurrences.push(new Date(current));
        }

        switch (type) {
            case 'daily':
                current.setDate(current.getDate() + interval);
                break;
            case 'weekly':
                if (days.length > 0) {
                    let found = false;
                    for (let i = 0; i < 7; i++) {
                        current.setDate(current.getDate() + 1);
                        if (days.includes(current.getDay())) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) current.setDate(current.getDate() + 7 * interval);
                } else {
                    current.setDate(current.getDate() + 7 * interval);
                }
                break;
            case 'monthly':
                current.setMonth(current.getMonth() + interval);
                break;
            case 'yearly':
                current.setFullYear(current.getFullYear() + interval);
                break;
            case 'custom':
                if (days.length > 0) {
                    let found = false;
                    for (let i = 0; i < 7; i++) {
                        current.setDate(current.getDate() + 1);
                        if (days.includes(current.getDay())) {
                            found = true;
                            break;
                        }
                    }
                    if (!found) current.setDate(current.getDate() + 7 * interval);
                }
                break;
            case 'smart':
                const intervalDays = smartInterval === 'weekly' ? 7 :
                    smartInterval === '10day' ? 10 : 30;
                const nextPeriodStart = new Date(current);
                nextPeriodStart.setDate(nextPeriodStart.getDate() + 1);
                const nextPeriodEnd = new Date(nextPeriodStart);
                nextPeriodEnd.setDate(nextPeriodEnd.getDate() + intervalDays - 1);
                const slot = findBestSlot(nextPeriodStart, nextPeriodEnd, events);
                const smartDate = new Date(slot.date);
                smartDate.setHours(slot.hour, slot.minute, 0, 0);
                if (smartDate <= end && smartDate >= fromDate) {
                    occurrences.push(smartDate);
                }
                current = smartDate;
                break;
            default:
                return occurrences;
        }
    }

    return occurrences;
}

/* =========================== GREGORIAN PICKER ============================ */

function renderYearPanel(container, selectedYear, fromYear, toYear, persian, onSelect) {
    container.innerHTML = '';
    var now = new Date();
    var thisYear = persian ? toJalali(now.getFullYear(), now.getMonth(), now.getDate()).jy : now.getFullYear();
    for (var y = fromYear; y <= toYear; y++) {
        var btn = document.createElement('button');
        btn.className = 'py-btn';
        btn.textContent = persian ? toPersianNumerals(y) : y;
        if (y === selectedYear) btn.classList.add('selected');
        if (y === thisYear) btn.classList.add('current-year');
        (function(year) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                onSelect(year);
            });
        })(y);
        container.appendChild(btn);
    }
    setTimeout(() => {
        var s = container.querySelector('.selected');
        if (s) s.scrollIntoView({
            block: 'center'
        });
    }, 0);
}

function isToday(gy, gm, gd) {
    const today = new Date();
    return today.getFullYear() === gy && today.getMonth() === gm && today.getDate() === gd;
}

function setDefaultTimeForToday(prefix, gy, gm, gd, force = false) {
    const hourEl = document.getElementById(prefix + '-hour');
    const minEl = document.getElementById(prefix + '-minute');
    const endHourEl = document.getElementById(prefix + '-end-hour');
    const endMinEl = document.getElementById(prefix + '-end-minute');
    if (!hourEl || !minEl) return;

    if (!isToday(gy, gm, gd)) {
        if (!hourEl.value && !minEl.value) {
            hourEl.value = '09';
            minEl.value = '00';
            if (endHourEl) endHourEl.value = '10';
            if (endMinEl) endMinEl.value = '00';
        }
        return;
    }

    const now = new Date();
    let curHour = now.getHours();
    let curMin = now.getMinutes();
    let startMin = Math.ceil((curMin + 1) / 15) * 15;
    let startHour = curHour + 1;
    if (startMin >= 60) {
        startMin = 0;
        startHour++;
    }
    startHour = startHour % 24;

    if (force || !hourEl.value || !minEl.value ||
        parseInt(hourEl.value) < startHour ||
        (parseInt(hourEl.value) === startHour && parseInt(minEl.value) < startMin)) {
        hourEl.value = String(startHour).padStart(2, '0');
        minEl.value = String(startMin).padStart(2, '0');
        if (endHourEl) endHourEl.value = String((startHour + 1) % 24).padStart(2, '0');
        if (endMinEl) endMinEl.value = String(startMin).padStart(2, '0');
    }
}

function updateAllDayAndTimeRows() {
    const gregAllDayRow = document.getElementById('all-day-greg-row');
    const gregTimeRow = document.querySelector('#greg-picker-popup .picker-time-row');
    const gregCheck = document.getElementById('event-all-day-greg');

    if (titlePickerActive) {
        if (gregAllDayRow) gregAllDayRow.style.display = 'none';
        if (gregTimeRow) gregTimeRow.style.display = 'none';
        return;
    }

    if (eventType === 'task') {
        if (gregAllDayRow) gregAllDayRow.style.display = 'none';
    } else {
        if (gregAllDayRow) gregAllDayRow.style.display = 'flex';
    }

    if (gregCheck && gregTimeRow) {
        gregTimeRow.style.display = gregCheck.checked ? 'none' : '';
    }
}

function syncTaskTimeVisibility() {
    const isTask = (eventType === 'task');
    const timeRow = document.querySelector('#greg-picker-popup .picker-time-row');
    if (!timeRow) return;
    const groups = timeRow.querySelectorAll('.time-group');
    if (groups.length >= 2) {
        groups[1].style.display = isTask ? 'none' : '';
        const sep = timeRow.querySelector('.time-range-sep');
        if (sep) sep.style.display = isTask ? 'none' : '';
    }
}

function openGregPicker(gy, gm, gd) {
    var now = new Date();
    gregState.gy = gy !== undefined ? gy : now.getFullYear();
    gregState.gm = gm !== undefined ? gm : now.getMonth();
    gregState.selectedGd = gd || null;
    renderGregPicker();
    gregPickerPopup.classList.add('open');

    if (gregState.selectedGd !== null) {
        setDefaultTimeForToday('greg', gregState.gy, gregState.gm, gregState.selectedGd, true);
    } else {
        setDefaultTimeForToday('greg', now.getFullYear(), now.getMonth(), now.getDate(), true);
    }
    updateAllDayAndTimeRows();
    syncTaskTimeVisibility();
}

function renderGregPicker() {
    var gy = gregState.gy,
        gm = gregState.gm;
    gregMonthBtn.textContent = GREG_MONTH_NAMES[gm];
    gregYearBtn.textContent = gy;
    gregMonthPopup.classList.remove('open');
    gregYearPopup.classList.remove('open');
    var today = new Date(),
        daysInMonth = new Date(gy, gm + 1, 0).getDate(),
        firstDay = new Date(gy, gm, 1).getDay();
    gregDaysEl.innerHTML = '';
    var prevDays = new Date(gy, gm, 0).getDate();
    for (var i = 0; i < firstDay; i++) {
        var el = document.createElement('div');
        el.className = 'picker-day other';
        el.textContent = prevDays - firstDay + 1 + i;
        gregDaysEl.appendChild(el);
    }
    for (var d = 1; d <= daysInMonth; d++) {
        var el = document.createElement('div');
        el.className = 'picker-day';
        el.textContent = d;
        if (d === today.getDate() && gm === today.getMonth() && gy === today.getFullYear()) el.classList.add('today');
        if (d === gregState.selectedGd) el.classList.add('selected');
        if (isGregDatePast(gy, gm, d)) {
            el.classList.add('past');
        } else {
            (function(day) {
                el.addEventListener('click', function() {
                    gregState.selectedGd = day;
                    renderGregPicker();
                    setDefaultTimeForToday('greg', gregState.gy, gregState.gm, gregState.selectedGd, false);
                });
            })(d);
        }
        gregDaysEl.appendChild(el);
    }
}

function openGregMonthPopup() {
    if (gregMonthPopup.classList.contains('open')) {
        gregMonthPopup.classList.remove('open');
        return;
    }
    gregYearPopup.classList.remove('open');
    gregMonthPopup.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'month-grid';
    for (var i = 0; i < 12; i++) {
        var item = document.createElement('div');
        item.className = 'month-item' + (i === gregState.gm ? ' selected' : '');
        item.textContent = GREG_MONTH_NAMES[i];
        (function(idx) {
            item.addEventListener('click', function(e) {
                e.stopPropagation();
                gregState.gm = idx;
                renderGregPicker();
            });
        })(i);
        grid.appendChild(item);
    }
    gregMonthPopup.appendChild(grid);
    gregMonthPopup.classList.add('open');
}

function openGregYearPopup() {
    if (gregYearPopup.classList.contains('open')) {
        gregYearPopup.classList.remove('open');
        return;
    }
    gregMonthPopup.classList.remove('open');
    gregYearPopup.classList.add('open');
    renderYearPanel(gregYearPanel, gregState.gy, 2000, 2040, false, function(y) {
        gregState.gy = y;
        renderGregPicker();
    });
}

/* =========================== CALENDAR RENDERING ============================ */

/* ------------------------- RENDER DISPATCHER ------------------------- */
function syncViewTabsUI() {
    viewTabsEl.querySelectorAll('.view-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewMode));
}

function renderCalendar() {
    syncViewTabsUI();
    calendarGrid.className = 'calendar-grid';
    calendarGrid.removeAttribute('dir');
    calendarGrid.style.display = '';
    if (viewMode === 'month') {
        renderGregorianMonth();
    } else if (viewMode === 'day') {
        renderDayView();
    } else if (viewMode === 'year') {
        renderYearView();
    }
    animateTabIndicator();
    if (window.__lastMonthYearText !== currentMonthYearEl.textContent) {
        animateMonthYearChange(currentMonthYearEl.textContent);
        window.__lastMonthYearText = currentMonthYearEl.textContent;
    }
}

/* ------------------------- MONTH VIEW ------------------------- */
function renderGregorianMonth() {
    var year = currentDate.getFullYear(),
        month = currentDate.getMonth(),
        today = new Date();
    currentMonthYearEl.textContent = currentDate.toLocaleString('en-US', {
        month: 'long'
    }) + ' ' + year;
    calendarGrid.setAttribute('dir', 'ltr');
    calendarGrid.innerHTML = '';
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(d => {
        var el = document.createElement('div');
        el.className = 'day-name';
        el.textContent = d;
        calendarGrid.appendChild(el);
    });
    var firstDay = new Date(year, month, 1).getDay(),
        daysInMonth = new Date(year, month + 1, 0).getDate(),
        daysInPrev = new Date(year, month, 0).getDate();
    for (var i = 0; i < firstDay; i++) calendarGrid.appendChild(makeGregCell(year, month - 1, daysInPrev - firstDay + 1 + i, true));
    for (var d = 1; d <= daysInMonth; d++) {
        var isToday = (d === today.getDate() && month === today.getMonth() && year === today.getFullYear());
        calendarGrid.appendChild(makeGregCell(year, month, d, false, isToday));
    }
    var total = firstDay + daysInMonth,
        trailing = (7 - (total % 7)) % 7;
    for (var t = 1; t <= trailing; t++) calendarGrid.appendChild(makeGregCell(year, month + 1, t, true));
}

function makeGregCell(year, month, day, otherMonth, isToday) {
    var normDate = new Date(year, month, day),
        ny = normDate.getFullYear(),
        nm = normDate.getMonth(),
        nd = normDate.getDate();
    var cell = document.createElement('div');
    cell.className = 'day-cell' + (otherMonth ? ' other-month' : '') + (isToday ? ' today' : '');
    var numEl = document.createElement('span');
    numEl.className = 'day-number';
    numEl.textContent = day;
    cell.appendChild(numEl);
    var holiday = getGregHoliday(ny, nm, nd);
    if (holiday) {
        var hl = document.createElement('span');
        hl.className = 'holiday-label';
        hl.textContent = holiday;
        cell.appendChild(hl);
    }
    var dayEvents = events.filter(ev => {
        if (!ev.start_date) return false;
        var d = new Date(ev.start_date);
        if (d.getFullYear() === ny && d.getMonth() === nm && d.getDate() === nd) return true;
        if (ev.recurrence_type !== 'none') {
            const monthStart = new Date(ny, nm, 1);
            const monthEnd = new Date(ny, nm + 1, 0, 23, 59, 59);
            const recDates = getRecurrenceDates(ev, monthStart, monthEnd);
            return recDates.some(rd => rd.getFullYear() === ny && rd.getMonth() === nm && rd.getDate() === nd);
        }
        return false;
    });
    dayEvents.forEach(ev => {
        var dot = document.createElement('div');
        dot.className = 'event-dot';
        if (ev.status === 'completed' || ev.status === 'done') {
            dot.classList.add('completed');
        } else {
            dot.style.backgroundColor = ev.color || 'var(--accent)';
        }
        // اضافه کردن شرط دعوت
        if (ev.invitation_status === 'pending') {
            dot.classList.add('invited'); // کلاس جدید
            dot.style.backgroundColor = ev.color || 'var(--accent)'; // رنگ اصلی خودش
        }
        cell.appendChild(dot);
    });
    cell.addEventListener('click', () => {
        currentDate = new Date(ny, nm, nd);
        viewMode = 'day';
        syncViewTabsUI();
        renderCalendar();
    });
    return cell;
}

/* ------------------------- DAY VIEW ------------------------- */
function renderDayView() {
    var viewDate = new Date(currentDate);
    var vy = viewDate.getFullYear(),
        vm = viewDate.getMonth(),
        vd = viewDate.getDate();

    var dayEvents = events.filter(ev => {
        if (!ev.start_date) return false;
        var d = new Date(ev.start_date);
        if (d.getFullYear() === vy && d.getMonth() === vm && d.getDate() === vd) return true;
        if (ev.recurrence_type !== 'none') {
            var dayStart = new Date(vy, vm, vd, 0, 0, 0);
            var dayEnd   = new Date(vy, vm, vd, 23, 59, 59);
            var recDates = getRecurrenceDates(ev, dayStart, dayEnd);
            return recDates.some(rd => rd.getFullYear() === vy && rd.getMonth() === vm && rd.getDate() === vd);
        }
        return false;
    });

    var occupiedHours = new Array(24).fill(false);
    dayEvents.forEach(ev => {
        var start = new Date(ev.start_date);
        var end = ev.end_date ? new Date(ev.end_date) : new Date(start.getTime() + 60 * 60 * 1000);
        var startMin = start.getHours() * 60 + start.getMinutes();
        var endMin   = end.getHours() * 60 + end.getMinutes();
        if (endMin <= startMin) endMin = startMin + 15;
        var sh = Math.floor(startMin / 60);
        var eh = Math.ceil(endMin / 60);
        for (var h = sh; h < eh && h < 24; h++) {
            occupiedHours[h] = true;
        }
    });

    var hourHeights = occupiedHours.map(occ => occ ? 60 : 20);
    var totalHeight = hourHeights.reduce((sum, h) => sum + h, 0);

    calendarGrid.className = 'day-view-timeline';
    calendarGrid.innerHTML = '';

    var timeLabels = document.createElement('div');
    timeLabels.className = 'time-labels';
    for (var h = 0; h < 24; h++) {
        var label = document.createElement('div');
        label.className = 'time-label';
        label.style.height = hourHeights[h] + 'px';
        label.textContent = String(h).padStart(2, '0') + ':00';
        timeLabels.appendChild(label);
    }

    var slots = document.createElement('div');
    slots.className = 'time-slots';
    slots.style.height = totalHeight + 'px';
    calendarGrid.appendChild(timeLabels);
    calendarGrid.appendChild(slots);

    // Hour lines
    var cumulativeTop = 0;
    for (var h = 0; h < 24; h++) {
        var lineEl = document.createElement('div');
        lineEl.style.position = 'absolute';
        lineEl.style.left = '0';
        lineEl.style.right = '0';
        lineEl.style.height = '1px';
        lineEl.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        lineEl.style.top = cumulativeTop + 'px';
        lineEl.style.zIndex = '0';
        lineEl.style.pointerEvents = 'none';
        slots.appendChild(lineEl);
        cumulativeTop += hourHeights[h];
    }

    requestAnimationFrame(function() {
        var eventsWithMinutes = dayEvents.map(ev => {
            var start = new Date(ev.start_date);
            var end = ev.end_date ? new Date(ev.end_date) : new Date(start.getTime() + 60 * 60 * 1000);
            return {
                ev,
                startMin: start.getHours() * 60 + start.getMinutes(),
                endMin: end.getHours() * 60 + end.getMinutes()
            };
        }).sort((a, b) => a.startMin - b.startMin);

        var lanes = [];
        eventsWithMinutes.forEach(item => {
            var laneIndex = -1;
            for (var i = 0; i < lanes.length; i++) {
                var lastEventInLane = lanes[i][lanes[i].length - 1];
                if (lastEventInLane.endMin <= item.startMin) {
                    laneIndex = i;
                    break;
                }
            }
            if (laneIndex === -1) {
                lanes.push([item]);
            } else {
                lanes[laneIndex].push(item);
            }
        });

        var laneCount = lanes.length;
        const SLOT_PADDING = 10;
        lanes.forEach((laneEvents, laneIndex) => {
            laneEvents.forEach(item => {
                var startMin = item.startMin;
                var endMin = item.endMin;
                if (endMin <= startMin) endMin = startMin + 15;

                var topPx = 0;
                for (var h = 0; h < 24; h++) {
                    if (h < Math.floor(startMin / 60)) {
                        topPx += hourHeights[h];
                    } else if (h === Math.floor(startMin / 60)) {
                        var minuteInHour = startMin % 60;
                        topPx += (minuteInHour / 60) * hourHeights[h];
                        break;
                    }
                }

                var heightPx = 0;
                var curMin = startMin;
                while (curMin < endMin && curMin < 24 * 60) {
                    var hourIdx = Math.floor(curMin / 60);
                    var minsLeft = 60 - (curMin % 60);
                    var minsToEnd = Math.min(endMin - curMin, minsLeft);
                    heightPx += (minsToEnd / 60) * hourHeights[hourIdx];
                    curMin += minsToEnd;
                }

                var slotsWidth = slots.clientWidth;
                if (slotsWidth === 0) slotsWidth = 600;

                var gapPx = 15;
                var totalGap = gapPx * (laneCount - 1);
                var availableWidth = slotsWidth - 2 * SLOT_PADDING - totalGap;
                var laneWidthPx = availableWidth / laneCount;

                var leftPx = SLOT_PADDING + laneIndex * (laneWidthPx + gapPx);

                var evEl = document.createElement('div');
                evEl.className = 'time-slot-event';

                // وضعیت دعوت (pending) → چشمک‌زن با رنگ اصلی
                if (item.ev.invitation_status === 'pending') {
                    evEl.classList.add('event-invited');
                    if (item.ev.color) {
                        evEl.style.border = '2px solid ' + item.ev.color;
                        evEl.style.backgroundColor = item.ev.color + '26';
                    } else {
                        evEl.style.border = '2px solid var(--accent)';
                        evEl.style.backgroundColor = 'rgba(255, 111, 145, 0.15)';
                    }
                } else {
                    // رویدادهای معمولی
                    if (item.ev.status === 'completed' || item.ev.status === 'done') {
                        evEl.classList.add('event-completed');
                    }
                    if (item.ev.color) {
                        evEl.style.border = '2px solid ' + item.ev.color;
                        if (item.ev.location && item.ev.location.lat) {
                            evEl.style.backgroundColor = 'transparent';
                        } else {
                            evEl.style.backgroundColor = item.ev.color + '26';
                        }
                    } else {
                        evEl.style.border = '2px solid var(--accent)';
                        evEl.style.backgroundColor = 'rgba(255, 111, 145, 0.15)';
                    }
                }

                evEl.style.top = topPx + 'px';
                evEl.style.height = Math.max(heightPx, 28) + 'px';
                evEl.style.left = leftPx + 'px';
                evEl.style.width = laneWidthPx + 'px';

                // Mini map (در صورت وجود)
                if (item.ev.location && item.ev.location.lat && isLeafletReady()) {
                    evEl.style.position = 'relative';
                    var mapBg = document.createElement('div');
                    mapBg.className = 'event-map-bg';
                    evEl.appendChild(mapBg);
                    var overlay = document.createElement('div');
                    overlay.className = 'event-map-overlay';
                    overlay.style.backgroundColor = (item.ev.color || '#ff6f91') + '40';
                    evEl.appendChild(overlay);
                    (function(container, lat, lng) {
                        requestAnimationFrame(function() {
                            var miniMap = L.map(container, {
                                center: [lat, lng],
                                zoom: 15,
                                attributionControl: false,
                                zoomControl: false,
                                dragging: false,
                                scrollWheelZoom: false,
                                doubleClickZoom: false,
                                touchZoom: false,
                                keyboard: false,
                                interactive: false
                            });
                            L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                                maxZoom: 19
                            }).addTo(miniMap);
                        });
                    })(mapBg, item.ev.location.lat, item.ev.location.lng);
                }

                var titleSpan = document.createElement('div');
                titleSpan.className = 'event-title';
                if (item.ev.icon) {
                    var iconWrapper = document.createElement('span');
                    iconWrapper.className = 'event-icon';
                    iconWrapper.innerHTML = item.ev.icon;
                    titleSpan.appendChild(iconWrapper);
                    titleSpan.appendChild(document.createTextNode(' ' + (item.ev.title || 'Event')));
                } else {
                    titleSpan.textContent = item.ev.title || 'Event';
                }
                evEl.appendChild(titleSpan);

                // برچسب "Invited" برای دعوت‌های pending
                if (item.ev.invitation_status === 'pending') {
                    var invitedBadge = document.createElement('span');
                    invitedBadge.className = 'invited-badge';
                    invitedBadge.textContent = 'Invited';
                    evEl.appendChild(invitedBadge);
                }

                // ─── Action Buttons (قسمت اصلی تغییر) ───
                var actionsDiv = document.createElement('div');
                actionsDiv.className = 'event-actions';

                if (item.ev.parent_event_id && item.ev.invitation_status === 'accepted') {
                    // مهمان: فقط دکمه Leave
                    var leaveBtn = document.createElement('button');
                    leaveBtn.className = 'event-action-btn';
                    leaveBtn.textContent = 'Leave';
                    leaveBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        showConfirmModal('Leave this event? It will be removed from your calendar.', async function() {
                            await deleteEventFromDB(item.ev.id);
                            events = events.filter(e => e.id !== item.ev.id);
                            renderCalendar();
                        });
                    });
                    actionsDiv.appendChild(leaveBtn);

                } else if (item.ev.invitation_status === 'pending') {
                    // دعوت‌های pending: بدون دکمه

                } else {
                    // سازنده (host) یا رویداد عادی: Cancel + End/Done
                    var cancelBtn = document.createElement('button');
                    cancelBtn.className = 'event-action-btn';
                    cancelBtn.textContent = 'Cancel';
                    cancelBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        showConfirmModal('Are you sure you want to delete this event?', function() {
                            deleteEventById(item.ev.id);
                        });
                    });

                    var endBtn = document.createElement('button');
                    endBtn.className = 'event-action-btn';

                    if (item.ev.type === 'task') {
                        var occDate = new Date(vy, vm, vd).toISOString().split('T')[0];
                        var isDone = item.ev.completed_occurrences && Array.isArray(item.ev.completed_occurrences)
                                        ? item.ev.completed_occurrences.includes(occDate)
                                        : false;
                        endBtn.textContent = isDone ? 'Undo' : 'Done';
                        endBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            if (isDone) {
                                var idx = item.ev.completed_occurrences.indexOf(occDate);
                                if (idx > -1) item.ev.completed_occurrences.splice(idx, 1);
                                if (item.ev.completed_timestamps && item.ev.completed_timestamps[occDate]) {
                                    delete item.ev.completed_timestamps[occDate];
                                }
                                endBtn.textContent = 'Done';
                                evEl.style.opacity = '1';
                                evEl.style.textDecoration = 'none';
                            } else {
                                if (!item.ev.completed_occurrences) item.ev.completed_occurrences = [];
                                item.ev.completed_occurrences.push(occDate);
                                if (!item.ev.completed_timestamps) item.ev.completed_timestamps = {};
                                item.ev.completed_timestamps[occDate] = new Date().toISOString();
                                endBtn.textContent = 'Undo';
                                evEl.style.opacity = '0.6';
                                evEl.style.textDecoration = 'line-through';
                                showToast('Occurrence marked done. It will be auto‑deleted in 28 days.');
                            }
                            updateEventInDB(item.ev.id, {
                                completed_occurrences: item.ev.completed_occurrences,
                                completed_timestamps: item.ev.completed_timestamps
                            }).catch(function() {});
                            isDone = !isDone;
                        });
                        if (isDone) {
                            evEl.style.opacity = '0.6';
                            evEl.style.textDecoration = 'line-through';
                        }
                    } else { // event
                        var occDate = new Date(vy, vm, vd).toISOString().split('T')[0];
                        var isCompleted = item.ev.completed_occurrences && Array.isArray(item.ev.completed_occurrences)
                                            ? item.ev.completed_occurrences.includes(occDate)
                                            : false;
                        endBtn.textContent = isCompleted ? 'Undo' : 'End';
                        endBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            if (isCompleted) {
                                var idx = item.ev.completed_occurrences.indexOf(occDate);
                                if (idx > -1) item.ev.completed_occurrences.splice(idx, 1);
                                if (item.ev.completed_timestamps && item.ev.completed_timestamps[occDate]) {
                                    delete item.ev.completed_timestamps[occDate];
                                }
                                endBtn.textContent = 'End';
                                evEl.classList.remove('event-completed');
                            } else {
                                if (!item.ev.completed_occurrences) item.ev.completed_occurrences = [];
                                item.ev.completed_occurrences.push(occDate);
                                if (!item.ev.completed_timestamps) item.ev.completed_timestamps = {};
                                item.ev.completed_timestamps[occDate] = new Date().toISOString();
                                endBtn.textContent = 'Undo';
                                evEl.classList.add('event-completed');
                                showToast('Event marked done. It will be auto‑deleted in 28 days.');
                            }
                            updateEventInDB(item.ev.id, {
                                completed_occurrences: item.ev.completed_occurrences,
                                completed_timestamps: item.ev.completed_timestamps
                            }).catch(function() {});
                            isCompleted = !isCompleted;
                        });
                        if (isCompleted) {
                            evEl.classList.add('event-completed');
                        }
                    }

                    actionsDiv.appendChild(cancelBtn);
                    actionsDiv.appendChild(endBtn);
                }

                evEl.appendChild(actionsDiv);

                // کلیک روی رویداد
                evEl.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (item.ev.invitation_status === 'pending') {
                        openInvitationResponse(item.ev);
                    } else {
                        openEventDetail(item.ev, new Date(vy, vm, vd));
                    }
                });

                slots.appendChild(evEl);
            });
        });

        // Current time line
        var now = new Date();
        if (now.getFullYear() === vy && now.getMonth() === vm && now.getDate() === vd) {
            var nowMin = now.getHours() * 60 + now.getMinutes();
            var nowTopPx = 0;
            for (var h = 0; h < 24; h++) {
                if (h < Math.floor(nowMin / 60)) {
                    nowTopPx += hourHeights[h];
                } else if (h === Math.floor(nowMin / 60)) {
                    nowTopPx += (nowMin % 60) / 60 * hourHeights[h];
                    break;
                }
            }
            var line = document.createElement('div');
            line.className = 'current-time-line';
            line.style.top = nowTopPx + 'px';
            line.style.left = '0';
            line.style.right = '-10px';
            slots.appendChild(line);
        }

        slots.addEventListener('click', function(e) {
            if (e.target !== slots) return;
            var rect = slots.getBoundingClientRect();
            var y = e.clientY - rect.top;
            var acc = 0, clickMin = 0;
            for (var h = 0; h < 24; h++) {
                if (y < acc + hourHeights[h]) {
                    var offsetInHour = y - acc;
                    clickMin = h * 60 + (offsetInHour / hourHeights[h]) * 60;
                    break;
                }
                acc += hourHeights[h];
            }
            var hours = Math.floor(clickMin / 60);
            var minutes = Math.round(clickMin % 60);
            minutes = Math.round(minutes / 15) * 15;
            if (minutes === 60) { minutes = 0; hours++; }
            if (hours >= 24) hours = 23;

            var clickDate = new Date(vy, vm, vd, hours, minutes, 0, 0);
            openNewEventAtTime(clickDate);
        });

        currentMonthYearEl.textContent = viewDate.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
    });
}
/* ------------------------- YEAR VIEW ------------------------- */
function renderYearView() {
    calendarGrid.className = 'year-grid';
    calendarGrid.innerHTML = '';
    var today = new Date();
    var year = currentDate.getFullYear();
    currentMonthYearEl.textContent = year;
    for (var m = 0; m < 12; m++) calendarGrid.appendChild(makeYearMonthCard_Greg(year, m, today));
}

function makeYearMonthCard_Greg(year, month, today) {
    var card = document.createElement('div');
    card.className = 'year-month-card';
    var nameEl = document.createElement('div');
    nameEl.className = 'ym-name';
    nameEl.textContent = new Date(year, month).toLocaleString('en-US', {
        month: 'short'
    });
    card.appendChild(nameEl);
    var daysInMonth = new Date(year, month + 1, 0).getDate(),
        firstDay = new Date(year, month, 1).getDay();
    var miniGrid = document.createElement('div');
    miniGrid.className = 'ym-grid';
    for (var i = 0; i < firstDay; i++) miniGrid.appendChild(document.createElement('span'));
    for (var d = 1; d <= daysInMonth; d++) {
        var span = document.createElement('span');
        span.textContent = d;
        if (d === today.getDate() && month === today.getMonth() && year === today.getFullYear()) span.className = 'ym-today';
        if (getGregHoliday(year, month, d)) span.classList.add('ym-holiday');
        miniGrid.appendChild(span);
    }
    card.appendChild(miniGrid);
    card.addEventListener('click', () => {
        currentDate = new Date(year, month, 1);
        viewMode = 'month';
        syncViewTabsUI();
        renderCalendar();
    });
    return card;
}

/* =========================== EVENT TYPE & TIME ============================ */

function setEventType(type) {
    eventType = type;
    const toggle = document.getElementById('event-type-toggle');
    if (!toggle) return;
    const labels = toggle.querySelectorAll('.event-type-label');
    const thumb = toggle.querySelector('.event-type-thumb');
    labels.forEach(l => l.classList.toggle('active', l.dataset.type === type));
    const activeLabel = toggle.querySelector(`.event-type-label[data-type="${type}"]`);
    if (activeLabel && thumb) {
        const labelRect = activeLabel.getBoundingClientRect();
        if (labelRect.width === 0) {
            requestAnimationFrame(() => setEventType(type));
            return;
        }
        const toggleRect = toggle.getBoundingClientRect();
        thumb.style.left = (labelRect.left - toggleRect.left) + 'px';
        thumb.style.width = labelRect.width + 'px';
    }

    const titleInput = document.getElementById('event-title');
    if (titleInput) {
        titleInput.placeholder = type === 'task' ? 'Task title' : 'Event title';
    }

    const checklistBtn = document.getElementById('toggle-checklist-mode-btn');
    if (checklistBtn) {
        checklistBtn.style.display = (type === 'task') ? 'flex' : 'none';
    }

    const locBtn = document.getElementById('toggle-location-btn');
    if (locBtn) {
        locBtn.style.display = (type === 'event') ? 'flex' : 'none';
    }

    const inviteBtn = document.getElementById('toggle-invite-btn');
    if (inviteBtn) {
        inviteBtn.style.display = (type === 'event') ? 'flex' : 'none';
    }

    if (type !== 'task') {
        hideInlineChecklist();
        currentChecklistItems = [];
    }

    updateAllDayAndTimeRows();
    syncTaskTimeVisibility();
}

function setEventType(type) {
    eventType = type;
    const toggle = document.getElementById('event-type-toggle');
    if (!toggle) return;
    const labels = toggle.querySelectorAll('.event-type-label');
    const thumb = toggle.querySelector('.event-type-thumb');
    labels.forEach(l => l.classList.toggle('active', l.dataset.type === type));
    const activeLabel = toggle.querySelector(`.event-type-label[data-type="${type}"]`);
    if (activeLabel && thumb) {
        const labelRect = activeLabel.getBoundingClientRect();
        if (labelRect.width === 0) {
            requestAnimationFrame(() => setEventType(type));
            return;
        }
        const toggleRect = toggle.getBoundingClientRect();
        thumb.style.left = (labelRect.left - toggleRect.left) + 'px';
        thumb.style.width = labelRect.width + 'px';
    }

    const titleInput = document.getElementById('event-title');
    if (titleInput) {
        titleInput.placeholder = type === 'task' ? 'Task title' : 'Event title';
    }

    const checklistBtn = document.getElementById('toggle-checklist-mode-btn');
    if (checklistBtn) {
        checklistBtn.style.display = (type === 'task') ? 'flex' : 'none';
    }

    const locBtn = document.getElementById('toggle-location-btn');
    if (locBtn) {
        locBtn.style.display = (type === 'event') ? 'flex' : 'none';
    }

    const inviteBtn = document.getElementById('toggle-invite-btn');
    if (inviteBtn) {
        inviteBtn.style.display = (type === 'event') ? 'flex' : 'none';
    }

    const wrapper = document.getElementById('textarea-wrapper');
    if (wrapper) {
        wrapper.classList.toggle('task-tab-active', type === 'task');
    }

    if (type !== 'task') {
        hideInlineChecklist();
        currentChecklistItems = [];
    }

    updateAllDayAndTimeRows();
    syncTaskTimeVisibility();
}

/* ------------------------- TIME VALIDATION & SPINNER ------------------------- */
function getSelectedGregFor(prefix) {
    if (prefix === 'greg') {
        if (gregState.selectedGd === null) return null;
        return {
            gy: gregState.gy,
            gm: gregState.gm,
            gd: gregState.selectedGd
        };
    }
    return null;
}

function validateTimeInput(prefix, isEnd = false) {
    const hourEl = document.getElementById(prefix + (isEnd ? '-end-hour' : '-hour'));
    const minEl = document.getElementById(prefix + (isEnd ? '-end-minute' : '-minute'));
    if (!hourEl || !minEl) return;

    const g = getSelectedGregFor(prefix);
    if (!g) return;

    let hour = parseInt(hourEl.value, 10);
    let minute = parseInt(minEl.value, 10);
    if (isNaN(hour) || isNaN(minute)) return;

    minute = Math.round(minute / 15) * 15;
    if (minute === 60) {
        minute = 0;
        hour++;
    }

    if (!isEnd && isToday(g.gy, g.gm, g.gd)) {
        const now = new Date();
        const curHour = now.getHours();
        const curMinute = now.getMinutes();
        const nowTotal = curHour * 60 + curMinute;
        const selTotal = hour * 60 + minute;
        if (selTotal <= nowTotal) {
            let newMin = Math.ceil((curMinute + 1) / 15) * 15;
            let newHour = curHour + 1;
            if (newMin >= 60) {
                newMin = 0;
                newHour++;
            }
            newHour = newHour % 24;
            hour = newHour;
            minute = newMin;
        }
    }

    const startHourEl = document.getElementById(prefix + '-hour');
    const startMinEl = document.getElementById(prefix + '-minute');
    if (startHourEl && startMinEl) {
        const startH = parseInt(startHourEl.value, 10);
        const startM = parseInt(startMinEl.value, 10);
        if (!isNaN(startH) && !isNaN(startM)) {
            const startTotal = startH * 60 + startM;
            const endTotal = hour * 60 + minute;
            if (endTotal <= startTotal) {
                hour = (startH + 1) % 24;
                minute = startM;
            }
        }
    }

    hourEl.value = String(hour).padStart(2, '0');
    minEl.value = String(minute).padStart(2, '0');
}

function syncEndTimeOnStartChange(prefix) {
    const startHour = document.getElementById(prefix + '-hour');
    const startMin = document.getElementById(prefix + '-minute');
    const endHour = document.getElementById(prefix + '-end-hour');
    const endMin = document.getElementById(prefix + '-end-minute');
    if (!startHour || !startMin || !endHour || !endMin) return;

    const sh = parseInt(startHour.value, 10);
    const sm = parseInt(startMin.value, 10);
    if (isNaN(sh) || isNaN(sm)) return;

    const eh = parseInt(endHour.value, 10);
    const em = parseInt(endMin.value, 10);
    if (!isNaN(eh) && !isNaN(em)) {
        if (eh > sh || (eh === sh && em > sm)) return;
    }
    endHour.value = String((sh + 1) % 24).padStart(2, '0');
    endMin.value = String(sm).padStart(2, '0');
}

/* ------------------------- OPEN NEW EVENT AT TIME ------------------------- */
function openNewEventAtTime(date) {
    if (!currentUser) {
        openModal(authOverlay);
        authError.textContent = 'Please sign in to add events.';
        return;
    }

    editingEventId = null;
    eventTitleInput.value = '';
    eventType = 'event';
    setEventType('event');
    document.getElementById('event-type-toggle').style.display = '';

    var year = date.getFullYear();
    var month = date.getMonth();
    var day = date.getDate();
    var hours = date.getHours();
    var mins = date.getMinutes();

    var dateStr = year + '-' + pad(month + 1) + '-' + pad(day);
    eventStartGreg.value = dateStr;
    eventStartInput.value = dateStr + 'T' + pad(hours) + ':' + pad(mins);
    gregDateRow.style.display = 'block';
    gregTriggerText.textContent = GREG_MONTH_NAMES[month] + ' ' + day + ', ' + year + '  ' + pad(hours) + ':' + pad(mins);
    gregPickerTrigger.classList.add('has-value');

    eventEndInput.value = '';
    selectedTagColor = '#f5f5f5';
    recurrence = {
        type: 'none',
        interval: 1,
        days: []
    };
    updateRecurrencePreview();
    hideInlineChecklist();
    currentChecklistItems = [];
    currentInvitees = [];
    document.getElementById('location-section').style.display = 'none';
    document.getElementById('toggle-location-btn')?.classList.remove('active');
    document.getElementById('toggle-invite-btn')?.classList.remove('active');
    document.getElementById('toggle-color-btn')?.classList.remove('active');
    document.getElementById('toggle-icon-btn')?.classList.remove('active');

    openModal(eventModal);
}

function openTitlePicker() {
    titlePickerActive = true;

    const gregAllDayRow = document.getElementById('all-day-greg-row');
    const gregTimeRow = document.querySelector('#greg-picker-popup .picker-time-row');
    if (gregAllDayRow) gregAllDayRow.style.display = 'none';
    if (gregTimeRow) gregTimeRow.style.display = 'none';

    document.getElementById('greg-today-btn').style.display = 'block';

    openGregPicker(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());
}

async function openEditModal(ev) {
    if (!ev) return;
    editingEventId = ev.id;
    document.getElementById('event-type-toggle').style.display = 'none';

    if (eventTitleInput) eventTitleInput.value = ev.title || '';

    if (ev.start_date) {
        const startDate = new Date(ev.start_date);
        const y = startDate.getFullYear();
        const m = startDate.getMonth();
        const d = startDate.getDate();
        const hours = startDate.getHours();
        const mins = startDate.getMinutes();

        if (eventStartGreg) eventStartGreg.value = `${y}-${pad(m + 1)}-${pad(d)}`;
        if (eventStartInput) eventStartInput.value = ev.start_date;
        if (gregTriggerText) {
            gregTriggerText.textContent = `${GREG_MONTH_NAMES[m]} ${d}, ${y}  ${pad(hours)}:${pad(mins)}`;
            gregPickerTrigger.classList.add('has-value');
        }
    } else {
        if (eventStartInput) eventStartInput.value = '';
        if (eventStartGreg) eventStartGreg.value = '';
        if (gregTriggerText) gregTriggerText.textContent = 'Select date';
        if (gregPickerTrigger) gregPickerTrigger.classList.remove('has-value');
    }

    if (eventEndInput) {
        eventEndInput.value = ev.end_date || '';
    }

    const gregCheck = document.getElementById('event-all-day-greg');
    if (gregCheck) gregCheck.checked = ev.all_day || false;

    setEventType(ev.type || 'event');
    const inviteBtn = document.getElementById('toggle-invite-btn');
    if (inviteBtn && ev.type === 'event') {
        inviteBtn.style.display = 'flex';
    }

    const locBtn = document.getElementById('toggle-location-btn');
    if (locBtn && ev.type === 'event') {
        locBtn.style.display = 'flex';
    }

    selectedTagColor = ev.color || '#f5f5f5';
    const colorBtn = document.getElementById('toggle-color-btn');
    if (colorBtn) {
        colorBtn.classList.toggle('active', selectedTagColor !== '#f5f5f5');
    }

    const descField = document.getElementById('event-description');
    if (descField) descField.value = ev.description || '';

    recurrence.type = ev.recurrence_type || 'none';
    recurrence.interval = ev.recurrence_interval || 1;
    recurrence.days = ev.recurrence_days || [];
    recurrence.smartInterval = ev.recurrence_smart_interval || 'weekly';
    updateRecurrencePreview();

    if (ev.type === 'task' && ev.checklist && ev.checklist.length) {
        currentChecklistItems = JSON.parse(JSON.stringify(ev.checklist));
        const toggleBtn = document.getElementById('toggle-checklist-mode-btn');
        if (toggleBtn) {
            toggleBtn.style.display = 'flex';
        }
    } else {
        currentChecklistItems = [];
        hideInlineChecklist();
        const toggleBtn = document.getElementById('toggle-checklist-mode-btn');
        if (toggleBtn) toggleBtn.style.display = 'none';
    }

    // Load location
    if (ev.location && (ev.location.lat || ev.location.name)) {
        currentLocationCoords = ev.location.lat && ev.location.lng ? {
            lat: ev.location.lat,
            lng: ev.location.lng
        } : null;
        currentLocationName = ev.location.name || '';
        currentLocationAddress = ev.location?.address || null;
        document.getElementById('location-section').style.display = 'none';
        const locBtn = document.getElementById('toggle-location-btn');
        if (locBtn) locBtn.classList.add('active');
    } else {
        currentLocationCoords = null;
        currentLocationName = '';
        currentLocationAddress = null;
        document.getElementById('location-coords-input').value = '';
        document.getElementById('location-section').style.display = 'none';
        const locBtn = document.getElementById('toggle-location-btn');
        if (locBtn) locBtn.classList.remove('active');
    }

    // Load invitees
    // Load invitees from invitee_ids (ecosystem)
    currentInvitees = [];
    if (ev.invitee_ids && Array.isArray(ev.invitee_ids) && ev.invitee_ids.length > 0) {
        try {
            const {
                data: profiles
            } = await sb.from('profiles')
                .select('id, first_name, last_name')
                .in('id', ev.invitee_ids);
            if (profiles) {
                currentInvitees = profiles.map(p => ({
                    id: p.id,
                    name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'User'
                }));
            }
        } catch (e) {
            currentInvitees = ev.invitee_ids.map(id => ({
                id,
                name: 'Unknown'
            }));
        }
    }
    if (currentInvitees.length > 0) {
        const inviteBtn = document.getElementById('toggle-invite-btn');
        if (inviteBtn) inviteBtn.classList.add('active');
    }

    if (gregDateRow) gregDateRow.style.display = 'block';
    updateAllDayAndTimeRows();
    openModal(eventModal);
}

/* =========================== EVENT SAVE ============================ */
async function saveEvent() {
    try {
        // ── 1. Get form values ──────────────────────────────
        var title = '';
        if (eventTitleInput) title = eventTitleInput.value.trim();

        var allDay = false;
        var gregCheck = document.getElementById('event-all-day-greg');
        if (gregCheck) allDay = gregCheck.checked;

        var start = '';
        if (eventStartInput) start = eventStartInput.value;
        if (!title || !start) {
            alert('Title and start date are required.');
            return;
        }

        var endDate = null;
        if (eventType !== 'task' && eventEndInput && eventEndInput.value) {
            endDate = eventEndInput.value;
        }

        var desc = '';
        var descEl = document.getElementById('event-description');
        if (descEl) desc = descEl.value.trim();

        // ── 2. Build main payload ─────────────────────────
        var payload = {
            title: title,
            start_date: new Date(start).toISOString(),
            end_date: endDate ? new Date(endDate).toISOString() : null,
            all_day: allDay,
            type: eventType,
            reminder_minutes: 0,
            color: selectedTagColor,
            icon: selectedIcon || null,
            description: desc,
            recurrence_type: recurrence.type,
            recurrence_interval: recurrence.interval,
            recurrence_days: (recurrence.type === 'weekly' || recurrence.type === 'custom') ? recurrence.days : [],
            recurrence_smart_interval: recurrence.type === 'smart' ? recurrence.smartInterval : null,
            invitees: eventType === 'event' ? currentInvitees.map(inv => inv.name) : [],
            // Checklist items (بدون تبدیل به متن)
            checklist: eventType === 'task' ? currentChecklistItems : []
        };

        // ── 3. Location (فقط برای event) ──────────────────
        if (eventType === 'event' && (currentLocationCoords || currentLocationName)) {
            payload.location = {
                lat: currentLocationCoords?.lat || null,
                lng: currentLocationCoords?.lng || null,
                name: currentLocationName || '',
                address: currentLocationAddress || null
            };
        } else {
            payload.location = null;
        }

        // ── 4. Completed occurrences ──────────────────────
        if (!editingEventId) {
            payload.completed_occurrences = [];
            payload.completed_timestamps = {};
        }

        // ── 5. Invitee IDs ────────────────────────────────
        payload.invitee_ids = currentInvitees.map(inv => inv.id);

        // ── 6. Save to database ───────────────────────────
        showGlobalLoader();

        if (editingEventId) {
            // Update existing event
            await updateEventInDB(editingEventId, payload);
            var idx = events.findIndex(function(ev) {
                return ev.id == editingEventId;
            });
            if (idx !== -1) {
                // حفظ کردن completed_occurrences و completed_timestamps موجود
                if (events[idx].completed_occurrences) {
                    payload.completed_occurrences = events[idx].completed_occurrences;
                }
                if (events[idx].completed_timestamps) {
                    payload.completed_timestamps = events[idx].completed_timestamps;
                }
                Object.assign(events[idx], payload);
            }
            editingEventId = null;
        } else {
            // Create new event
            var saved = await saveEventToDB(payload);
            if (saved) {
                // Push to local events array
                events.push(saved);

                // ── 7. Create invitee rows (if any) ─────────
                if (currentInvitees.length > 0) {
                    for (const invitee of currentInvitees) {
                        const invitePayload = {
                            ...payload,
                            user_id: invitee.id,
                            parent_event_id: saved.id,
                            invitation_status: 'pending',
                            invitees: [],
                            invitee_ids: [],
                            completed_occurrences: [],
                            completed_timestamps: {},
                            // checklist برای مهمان‌ها هم کپی میشه
                            checklist: eventType === 'task' ? currentChecklistItems : []
                        };

                        // Use RPC to bypass RLS (SECURITY DEFINER function)
                        const {
                            error: invErr
                        } = await sb
                            .rpc('insert_invited_event', {
                                payload: invitePayload
                            });

                        if (invErr) console.warn('Failed to insert invitee row:', JSON.stringify(invErr, null, 2));
                    }
                }

                // ── 8. Send notifications ─────────────────
                const eventTitle = title || 'Untitled event';
                currentInvitees.forEach(inv => {
                    addNotificationToUser(inv.id, 'event', 'You have been invited to an event',
                        `${currentProfile?.first_name || 'Someone'} invited you to "${eventTitle}"`, '#');
                });
            }
        }

        // ── 9. Clean up UI ────────────────────────────────
        hideGlobalLoader();
        closeModal(eventModal);

        // Reset form fields
        if (eventTitleInput) eventTitleInput.value = '';
        if (eventStartInput) eventStartInput.value = '';
        if (eventEndInput) eventEndInput.value = '';
        if (eventStartGreg) eventStartGreg.value = '';
        if (gregTriggerText) gregTriggerText.textContent = 'Select date';
        if (gregPickerTrigger) gregPickerTrigger.classList.remove('has-value');

        // Reset checklist
        currentChecklistItems = [];
        hideInlineChecklist();

        // Reset location
        currentLocationCoords = null;
        currentLocationName = '';
        currentLocationAddress = null;
        document.getElementById('location-coords-input').value = '';
        document.getElementById('location-section').style.display = 'none';
        document.getElementById('toggle-location-btn')?.classList.remove('active');

        // Reset invitees
        currentInvitees = [];
        document.getElementById('toggle-invite-btn')?.classList.remove('active');

        // Reset color
        selectedTagColor = '#f5f5f5';
        document.getElementById('toggle-color-btn')?.classList.remove('active');

        // Reset icon
        selectedIcon = null;
        updateIconButton();
        document.getElementById('toggle-icon-btn')?.classList.remove('active');

        // Reset recurrence
        recurrence = {
            type: 'none',
            interval: 1,
            days: [],
            smartInterval: 'weekly'
        };
        updateRecurrencePreview();

        // Reset event type to default
        eventType = 'event';
        setEventType('event');

        // Re-render calendar
        renderCalendar();
        updateNotificationDot();

        // Show success message
        showToast(editingEventId ? '✅ Event updated successfully!' : '✅ Event created successfully!');

    } catch (err) {
        console.error('Save event error:', err);
        alert('Error saving event: ' + err.message);
        hideGlobalLoader();
    }
}

function openEventDetail(ev, occurrenceDate) {
    currentDetailEventId = ev.id;
    currentDetailEvent = ev;

    // ─── Color & title ───
    document.getElementById('event-detail-title').textContent = ev.title || 'Untitled';
    const colorDot = document.getElementById('detail-color-dot');
    colorDot.style.backgroundColor = ev.color || '#f5f5f5';

    const detailHeader = document.querySelector('#event-detail-modal .detail-header');
    let iconSpan = document.getElementById('detail-icon');
    if (!iconSpan) {
        iconSpan = document.createElement('span');
        iconSpan.id = 'detail-icon';
        iconSpan.className = 'detail-icon';
        colorDot.after(iconSpan);
    }

    if (ev.icon) {
        iconSpan.innerHTML = ev.icon;
        iconSpan.style.color = ev.color || 'var(--accent)';
        iconSpan.style.display = 'inline-block';
        colorDot.style.display = 'none';
    } else {
        iconSpan.innerHTML = '';
        iconSpan.style.display = 'none';
        colorDot.style.display = 'inline-block';
    }

    const descIcon = document.getElementById('detail-desc-icon');
    if (descIcon) {
        descIcon.style.color = ev.color || 'var(--accent)';
    }
    const calIcon = document.getElementById('detail-calendar-icon');
    calIcon.style.color = ev.color || 'var(--accent)';

    // ─── Date and time ───
    const start = ev.start_date ? new Date(ev.start_date) : null;
    const end = ev.end_date ? new Date(ev.end_date) : null;
    let dateText = '';
    let timeText = '';
    let durationParen = '';

    if (start) {
        dateText = start.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        if (ev.all_day) {
            timeText = 'All day';
        } else {
            const fmtTime = d => d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
            timeText = fmtTime(start);
            if (end) {
                const diffMs = end.getTime() - start.getTime();
                if (diffMs > 0) {
                    const totalMinutes = Math.floor(diffMs / 60000);
                    const days = Math.floor(totalMinutes / 1440);
                    const hours = Math.floor((totalMinutes % 1440) / 60);
                    const mins = totalMinutes % 60;
                    let parts = [];
                    if (days > 0) parts.push(days + 'd');
                    if (hours > 0) parts.push(hours + 'h');
                    if (mins > 0) parts.push(mins + 'm');
                    if (parts.length > 0) durationParen = ' (' + parts.join(' ') + ')';
                }
            }
        }
    }

    document.getElementById('detail-date-text').textContent = dateText;
    document.getElementById('detail-time-text').textContent = timeText;
    document.getElementById('detail-duration-paren').textContent = durationParen;

    // ─── Hide horizontal dividers for tasks ───
    const dividers = eventDetailModal.querySelectorAll('.detail-divider-h');
    if (ev.type === 'task') {
        dividers.forEach(hr => hr.style.display = 'none');
    } else {
        dividers.forEach(hr => hr.style.display = '');
    }

    // ─── Description ───
    const descContainer = document.getElementById('detail-description-container');
    const descText = document.getElementById('detail-description-text');
    if (ev.description && ev.description.trim()) {
        descContainer.style.display = 'block';
        descText.textContent = ev.description;
    } else {
        descContainer.style.display = 'none';
    }

    // ─── CHECKLIST SECTION (برای تسک‌ها) ───
    // اطمینان از وجود container
    let checklistContainer = document.getElementById('detail-checklist-container');
    if (!checklistContainer) {
        // اگر وجود نداشت، بعد از توضیحات ایجادش کن
        const descContainer = document.getElementById('detail-description-container');
        if (descContainer && descContainer.parentNode) {
            checklistContainer = document.createElement('div');
            checklistContainer.id = 'detail-checklist-container';
            checklistContainer.className = 'detail-checklist-container';
            checklistContainer.style.display = 'none';
            
            const header = document.createElement('div');
            header.className = 'detail-checklist-header';
            header.innerHTML = `
                <span id="detail-checklist-icon" class="detail-icon" style="color:var(--accent);">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                </span>
                <span style="font-weight:600;font-size:14px;">Checklist</span>
            `;
            checklistContainer.appendChild(header);
            
            const listItems = document.createElement('div');
            listItems.id = 'detail-checklist-items';
            listItems.className = 'detail-checklist-items';
            checklistContainer.appendChild(listItems);
            
            descContainer.parentNode.insertBefore(checklistContainer, descContainer.nextSibling);
        }
    }

    // رندر چک‌لیست
    if (checklistContainer) {
        renderChecklistInDetail(ev);
    }

    // ─── Attendees section (only events) ───
    const inviteesSection = document.getElementById('detail-invitees-section');
    if (inviteesSection) {
        if (ev.type === 'event') {
            inviteesSection.style.display = 'block';
            const attendIcon = document.getElementById('detail-attendees-icon');
            if (attendIcon) attendIcon.style.color = ev.color || 'var(--accent)';

            const attendeesList = document.getElementById('detail-attendees-list');
            attendeesList.innerHTML = '';
            const invitees = ev.invitees || [];

            if (invitees.length === 0) {
                attendeesList.innerHTML = `
                    <div class="attendee-empty">
                        <div class="attendee-avatar empty-plus">+</div>
                        <span class="attendee-empty-text">Invite more people</span>
                    </div>`;
            } else if (invitees.length <= 3) {
                const colors = ['#f97316','#e11d48','#8b5cf6','#06b6d4','#10b981'];
                invitees.forEach((name, i) => {
                    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || name[0].toUpperCase();
                    const item = document.createElement('div');
                    item.className = 'attendee-item';
                    item.innerHTML = `
                        <div class="attendee-avatar" style="background-color:${colors[i % colors.length]}">${initials}</div>
                        <span class="attendee-name">${name}</span>`;
                    attendeesList.appendChild(item);
                });
            } else {
                const colors = ['#f97316','#e11d48'];
                const firstTwo = invitees.slice(0,2);
                const restCount = invitees.length - 2;
                const overlapRow = document.createElement('div');
                overlapRow.className = 'attendees-overlap-row';
                firstTwo.forEach((name, i) => {
                    const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2) || name[0].toUpperCase();
                    overlapRow.innerHTML += `
                        <div class="attendee-avatar" style="background-color:${colors[i]}">${initials}</div>`;
                });
                overlapRow.innerHTML += `<span class="attendee-extra-count">+${restCount} more</span>`;
                attendeesList.appendChild(overlapRow);
            }
        } else {
            inviteesSection.style.display = 'none';
        }
    }

    // ─── Location map ───
    const mapContainer = document.getElementById('detail-location-container');
    if (ev.location && (ev.location.lat || ev.location.lng)) {
        const lat = ev.location.lat;
        const lng = ev.location.lng;
        if (lat != null && lng != null && isLeafletReady() && mapContainer) {
            mapContainer.style.display = 'block';
            const coordsText = document.getElementById('detail-location-coords-text');
            if (coordsText) coordsText.textContent = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

            const overlay = document.getElementById('detail-map-address-overlay');
            if (ev.location.address) {
                const addr = ev.location.address;
                const place = addr.name || addr.road || addr.amenity || addr.shop || addr.tourism || '';
                const city = addr.city || addr.town || addr.village || addr.county || '';
                const country = addr.country || '';
                const parts = [place, city, country].filter(Boolean);
                if (overlay) {
                    overlay.textContent = parts.join(', ');
                    overlay.style.display = 'block';
                }
            } else if (overlay) {
                overlay.style.display = 'none';
            }

            setTimeout(() => {
                const detailMapDiv = document.getElementById('detail-location-map');
                if (detailMapDiv) {
                    if (detailMapDiv._leaflet_id) {
                        const oldMap = detailMapDiv._leaflet_map;
                        if (oldMap) oldMap.remove();
                        else delete detailMapDiv._leaflet_id;
                    }
                    const detailMap = L.map('detail-location-map', {
                        center: [lat, lng],
                        zoom: 15,
                        attributionControl: false,
                        zoomControl: false,
                        dragging: false,
                        scrollWheelZoom: false,
                        doubleClickZoom: false,
                        touchZoom: false,
                        keyboard: false,
                        interactive: false
                    });
                    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                        maxZoom: 19
                    }).addTo(detailMap);
                    const icon = getAccentPinIcon();
                    if (icon) L.marker([lat, lng], { icon }).addTo(detailMap);
                    else L.marker([lat, lng]).addTo(detailMap);
                    setTimeout(() => detailMap.invalidateSize(), 100);
                    const mapDivForClick = document.getElementById('detail-location-map');
                    if (mapDivForClick) {
                        mapDivForClick.style.cursor = 'pointer';
                        mapDivForClick.addEventListener('click', () => {
                            const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                            window.open(url, '_blank');
                        });
                    }
                }
            }, 200);
        }
    } else if (mapContainer) {
        mapContainer.style.display = 'none';
    }

    const oldConfirm = document.getElementById('event-detail-confirm');
    if (oldConfirm) oldConfirm.classList.add('hidden');
    const oldAddr = document.getElementById('detail-address-container');
    if (oldAddr) oldAddr.style.display = 'none';

    // ─── تشخیص مهمان بودن ───
    const isInvitee = !!ev.parent_event_id;

    // ─── دکمه Edit (فقط سازنده) ───
    const editBtn = document.getElementById('detail-edit-btn-top');
    if (editBtn) {
        editBtn.style.display = isInvitee ? 'none' : '';
        editBtn.onclick = () => {
            closeModal(eventDetailModal);
            const evToEdit = events.find(e => e.id == currentDetailEventId);
            if (evToEdit) openEditModal(evToEdit);
        };
    }

    // ─── وضعیت تکمیل (Complete / Undo) ───
    var dateForCompletion = null;
    if (occurrenceDate) {
        dateForCompletion = occurrenceDate.toISOString().split('T')[0];
    }
    var isCompleted = false;
    if (dateForCompletion && ev.recurrence_type !== 'none') {
        isCompleted = ev.completed_occurrences && Array.isArray(ev.completed_occurrences)
                        ? ev.completed_occurrences.includes(dateForCompletion)
                        : false;
    } else {
        isCompleted = (ev.status === 'completed' || ev.status === 'done');
    }

    const completeBtn = document.getElementById('detail-complete-btn');
    if (completeBtn) {
        // فقط برای سازنده نمایش داده شود
        completeBtn.style.display = isInvitee ? 'none' : '';

        if (isCompleted) {
            completeBtn.textContent = 'Undo';
            completeBtn.onclick = () => {
                if (dateForCompletion && ev.recurrence_type !== 'none') {
                    var idx = ev.completed_occurrences.indexOf(dateForCompletion);
                    if (idx > -1) ev.completed_occurrences.splice(idx, 1);
                    if (ev.completed_timestamps && ev.completed_timestamps[dateForCompletion]) {
                        delete ev.completed_timestamps[dateForCompletion];
                    }
                    updateEventInDB(ev.id, {
                        completed_occurrences: ev.completed_occurrences,
                        completed_timestamps: ev.completed_timestamps
                    }).then(() => {
                        closeModal(eventDetailModal);
                        renderCalendar();
                    }).catch(() => alert('Error undoing.'));
                } else {
                    updateEventInDB(ev.id, { status: 'pending', completed_at: null }).then(() => {
                        ev.status = 'pending';
                        ev.completed_at = null;
                        closeModal(eventDetailModal);
                        renderCalendar();
                    }).catch(() => alert('Error undoing.'));
                }
            };
        } else {
            completeBtn.textContent = (ev.type === 'task') ? 'Done' : 'End';
            completeBtn.onclick = () => {
                if (dateForCompletion && ev.recurrence_type !== 'none') {
                    if (!ev.completed_occurrences) ev.completed_occurrences = [];
                    ev.completed_occurrences.push(dateForCompletion);
                    if (!ev.completed_timestamps) ev.completed_timestamps = {};
                    ev.completed_timestamps[dateForCompletion] = new Date().toISOString();
                    updateEventInDB(ev.id, {
                        completed_occurrences: ev.completed_occurrences,
                        completed_timestamps: ev.completed_timestamps
                    }).then(() => {
                        alert('This occurrence will be automatically deleted after 28 days.');
                        closeModal(eventDetailModal);
                        renderCalendar();
                    }).catch(() => alert('Error completing.'));
                } else {
                    var newStatus = ev.type === 'task' ? 'done' : 'completed';
                    var payload = { status: newStatus, completed_at: new Date().toISOString() };
                    updateEventInDB(ev.id, payload).then(() => {
                        ev.status = newStatus;
                        ev.completed_at = payload.completed_at;
                        alert('This item will be automatically deleted after 28 days.');
                        closeModal(eventDetailModal);
                        renderCalendar();
                    }).catch(() => alert('Error completing.'));
                }
            };
        }
    }

    // ─── دکمه Delete / Leave ───
    const cancelBtn = document.getElementById('detail-cancel-btn');
    if (cancelBtn) {
        if (isInvitee) {
            cancelBtn.textContent = 'Leave Event';
            cancelBtn.onclick = () => {
                showConfirmModal('Leave this event? It will be removed from your calendar.', async () => {
                    await deleteEventFromDB(ev.id);
                    events = events.filter(e => e.id !== ev.id);
                    closeModal(eventDetailModal);
                    renderCalendar();
                });
            };
        } else {
            cancelBtn.textContent = 'Delete';
            cancelBtn.onclick = () => {
                showConfirmModal('Are you sure you want to delete this event?', () => {
                    deleteEventById(ev.id).then(() => {
                        closeModal(eventDetailModal);
                        renderCalendar();
                    }).catch(() => alert('Failed to delete event.'));
                });
            };
        }
    }

    const postponeBtn = document.getElementById('detail-postpone-btn');
    if (postponeBtn) {
        if (isInvitee) {
            postponeBtn.style.display = 'none';
        } else {
            postponeBtn.style.display = '';
            postponeBtn.onclick = () => openPostponeModal();
        }
    }

    openModal(eventDetailModal);
}

/* =========================== DELETE CONFIRMATION ============================ */

async function deleteEventById(id) {
    showGlobalLoader();
    try {
        const ok = await deleteEventFromDB(id);
        if (ok) {
            events = events.filter(ev => ev.id != id);
            renderCalendar();
            updateNotificationDot()
        }
    } catch (err) {
        console.error('Delete failed:', err);
        alert('Failed to delete event. Please try again.');
    } finally {
        hideGlobalLoader();
    }
}

function showDeleteConfirmation(eventId) {
    const actions = document.querySelector('.event-detail-actions');
    const confirm = document.getElementById('event-detail-confirm');
    if (actions) actions.style.display = 'none';
    if (confirm) {
        confirm.classList.remove('hidden');
        confirm.dataset.eventId = eventId;
        setTimeout(() => confirm.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest'
        }), 100);
    }
}

function hideDeleteConfirmation() {
    const actions = document.querySelector('.event-detail-actions');
    const confirm = document.getElementById('event-detail-confirm');
    if (actions) actions.style.display = '';
    if (confirm) {
        confirm.classList.add('hidden');
        delete confirm.dataset.eventId;
    }
}

/* =========================== CHECKLIST HELPERS ============================ */

function hideInlineChecklist() {
    const editor = document.getElementById('checklist-inline-editor');
    const toggleBtn = document.getElementById('toggle-checklist-mode-btn');
    if (editor) editor.style.display = 'none';
    if (toggleBtn) toggleBtn.classList.remove('active');
}

function showInlineChecklist() {
    const editor = document.getElementById('checklist-inline-editor');
    const toggleBtn = document.getElementById('toggle-checklist-mode-btn');
    if (editor) editor.style.display = 'block';
    if (toggleBtn) toggleBtn.classList.add('active');
    renderInlineChecklistItems(currentChecklistItems);
}

function renderInlineChecklistItems(items) {
    const container = document.getElementById('checklist-inline-items');
    if (!container) return;
    container.innerHTML = '';

    items.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'checklist-inline-row';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'neon-checkbox';
        cb.checked = item.done;
        cb.addEventListener('change', function() {
            item.done = this.checked;
        });

        const textSpan = document.createElement('span');
        textSpan.className = 'checklist-text';
        textSpan.textContent = item.text;
        textSpan.setAttribute('contenteditable', 'true');
        textSpan.addEventListener('input', function() {
            item.text = this.textContent.trim();
        });

        const delBtn = document.createElement('button');
        delBtn.className = 'delete-item-btn';
        delBtn.innerHTML = '✕';
        delBtn.addEventListener('click', () => {
            currentChecklistItems.splice(index, 1);
            renderInlineChecklistItems(currentChecklistItems);
        });

        const addSubBtn = document.createElement('button');
        addSubBtn.className = 'add-subtask-btn';
        addSubBtn.innerHTML = '+';
        addSubBtn.title = 'Add subtask';
        addSubBtn.addEventListener('click', () => {
            if (!item.subtasks) item.subtasks = [];
            item.subtasks.push({
                text: '',
                done: false
            });
            renderInlineChecklistItems(currentChecklistItems);
            const subRows = container.querySelectorAll('.subtask-row .checklist-text');
            if (subRows.length > 0) {
                const last = subRows[subRows.length - 1];
                last.focus();
                const range = document.createRange();
                range.selectNodeContents(last);
                range.collapse(false);
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(range);
            }
        });

        row.appendChild(cb);
        row.appendChild(textSpan);
        row.appendChild(addSubBtn);
        row.appendChild(delBtn);
        container.appendChild(row);

        if (item.subtasks && item.subtasks.length > 0) {
            item.subtasks.forEach((sub, subIndex) => {
                const subRow = document.createElement('div');
                subRow.className = 'checklist-inline-row subtask-row';

                const subCb = document.createElement('input');
                subCb.type = 'checkbox';
                subCb.className = 'neon-checkbox';
                subCb.checked = sub.done;
                subCb.addEventListener('change', function() {
                    sub.done = this.checked;
                });

                const subText = document.createElement('span');
                subText.className = 'checklist-text';
                subText.textContent = sub.text;
                subText.setAttribute('contenteditable', 'true');
                subText.addEventListener('input', function() {
                    sub.text = this.textContent.trim();
                });

                const subDelBtn = document.createElement('button');
                subDelBtn.className = 'delete-item-btn';
                subDelBtn.innerHTML = '✕';
                subDelBtn.addEventListener('click', () => {
                    item.subtasks.splice(subIndex, 1);
                    renderInlineChecklistItems(currentChecklistItems);
                });

                subRow.appendChild(subCb);
                subRow.appendChild(subText);
                subRow.appendChild(subDelBtn);
                container.appendChild(subRow);
            });
        }
    });
}

/* =========================== NAVIGATION ============================ */

function navigatePrev() {
    if (viewMode === 'year') {
        currentDate.setFullYear(currentDate.getFullYear() - 1);
    } else if (viewMode === 'month') {
        currentDate.setMonth(currentDate.getMonth() - 1);
    } else if (viewMode === 'day') {
        currentDate.setDate(currentDate.getDate() - 1);
    }
    renderCalendar();
}

function navigateNext() {
    if (viewMode === 'year') {
        currentDate.setFullYear(currentDate.getFullYear() + 1);
    } else if (viewMode === 'month') {
        currentDate.setMonth(currentDate.getMonth() + 1);
    } else if (viewMode === 'day') {
        currentDate.setDate(currentDate.getDate() + 1);
    }
    renderCalendar();
}

function handleTodayClick() {
    const today = new Date();
    currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    gregPickerPopup.classList.remove('open');
    titlePickerActive = false;
    document.getElementById('greg-today-btn').style.display = 'none';
    renderCalendar();
}

/* =========================== GSAP ANIMATIONS ============================ */

function animateTabIndicator() {
    const activeTab = viewTabsEl.querySelector('.view-tab.active');
    if (!activeTab || !tabIndicator) return;
    const tabRect = activeTab.getBoundingClientRect(),
        containerRect = viewTabsEl.getBoundingClientRect();
    gsap.to(tabIndicator, {
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
        duration: 0.4,
        ease: 'power2.out'
    });
}

/* =========================== EVENT LISTENERS ============================ */

/* --------- LOGOUT --------- */
document.getElementById('sidebar-logout')?.addEventListener('click', () => {
    openModal(document.getElementById('logout-confirm-modal'));
});
document.getElementById('logout-confirm-yes')?.addEventListener('click', () => {
    closeModal(document.getElementById('logout-confirm-modal'));
    logout();
});
document.getElementById('logout-confirm-no')?.addEventListener('click', () => {
    closeModal(document.getElementById('logout-confirm-modal'));
});
document.getElementById('logout-confirm-modal')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
        closeModal(e.currentTarget);
    }
});

/* --------- TODAY BUTTON --------- */
document.getElementById('greg-today-btn')?.addEventListener('click', handleTodayClick);

/* --------- AUTH OVERLAY CLICK --------- */
authOverlay.addEventListener('click', (e) => {
    if (e.target === authOverlay) closeModal(authOverlay);
});

/* --------- STEP-BASED AUTH FLOW --------- */
let authEmail = '';

function showStep(stepId) {
    document.querySelectorAll('.auth-step').forEach(el => el.classList.add('hidden'));
    document.getElementById(stepId)?.classList.remove('hidden');
}

document.getElementById('auth-continue-btn')?.addEventListener('click', async function() {
    const email = document.getElementById('auth-email').value.trim();
    const errorEl = document.getElementById('auth-error');
    if (!email) {
        errorEl.textContent = 'Please enter an email.';
        return;
    }
    authEmail = email;

    showGlobalLoader();
    try {
        const {
            data: exists,
            error: rpcError
        } = await sb.rpc('check_email_exists', {
            email_to_check: email
        });
        if (rpcError) throw rpcError;
        if (exists) {
            document.getElementById('auth-user-email').textContent = email;
            showStep('step-2-login');
        } else {
            showStep('step-2-register');
            document.getElementById('reg-form-fields').style.display = '';
            document.getElementById('reg-success').style.display = 'none';
        }
        document.getElementById('auth-error').textContent = '';
    } catch (e) {
        console.error(e);
        errorEl.textContent = 'Something went wrong. Try again.';
    } finally {
        hideGlobalLoader();
    }
});

document.getElementById('auth-signin-btn')?.addEventListener('click', async function() {
    const email = authEmail;
    const password = document.getElementById('auth-password').value;
    const errorEl = document.getElementById('auth-error-login');
    if (!email || !password) {
        errorEl.textContent = 'Please enter your password.';
        return;
    }

    showGlobalLoader();
    const {
        data,
        error
    } = await sb.auth.signInWithPassword({
        email,
        password
    });
    hideGlobalLoader();
    if (error) {
        errorEl.textContent = error.message;
        return;
    }

    currentUser = data.user;
    currentProfile = await buildCurrentProfile(currentUser);
    currentUserRole = currentProfile?.role || 'recruit';
    closeModal(authOverlay);
    updateAuthUI();
    events = await fetchEvents();
    renderCalendar();
    updateNotificationDot()
});

document.getElementById('auth-forgot-link')?.addEventListener('click', function(e) {
    e.preventDefault();
    document.getElementById('forgot-email').value = authEmail;
    showStep('step-forgot');
});

document.getElementById('auth-send-reset-btn')?.addEventListener('click', async function() {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) return;
    showGlobalLoader();
    const {
        error
    } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
    });
    hideGlobalLoader();
    if (error) {
        document.getElementById('auth-error-login').textContent = error.message;
        return;
    }
    document.getElementById('auth-success-msg').textContent = 'Password reset link sent.';
    document.getElementById('auth-success-msg').style.display = 'block';
});

document.getElementById('auth-back-to-login')?.addEventListener('click', function(e) {
    e.preventDefault();
    showStep('step-2-login');
});

document.getElementById('auth-register-btn')?.addEventListener('click', async function() {
    const firstname = document.getElementById('reg-firstname').value.trim();
    const lastname = document.getElementById('reg-lastname').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const errorEl = document.getElementById('auth-error-register');
    if (!firstname || !lastname || !password || !confirm) {
        errorEl.textContent = 'All fields are required.';
        return;
    }
    if (password !== confirm) {
        errorEl.textContent = 'Passwords do not match.';
        return;
    }
    showGlobalLoader();
    const {
        error
    } = await sb.auth.signUp({
        email: authEmail,
        password,
        options: {
            data: {
                first_name: firstname,
                last_name: lastname
            },
            emailRedirectTo: window.location.origin + window.location.pathname
        }
    });
    hideGlobalLoader();
    if (error) {
        errorEl.textContent = error.message;
        return;
    }

    document.getElementById('reg-form-fields').style.display = 'none';
    document.getElementById('reg-success').style.display = 'block';
    errorEl.textContent = '';
});

document.getElementById('reg-to-login-btn')?.addEventListener('click', function() {
    document.getElementById('auth-user-email').textContent = authEmail;
    showStep('step-2-login');
});

document.getElementById('sidebar-login')?.addEventListener('click', () => {
    openModal(authOverlay);
    showStep('step-1');
    document.getElementById('auth-email').value = '';
    authEmail = '';
    document.getElementById('auth-error').textContent = '';
});

document.querySelectorAll('.auth-step').forEach(step => {
    step.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            const map = {
                'step-1': 'auth-continue-btn',
                'step-2-login': 'auth-signin-btn',
                'step-2-register': 'auth-register-btn',
                'step-forgot': 'auth-send-reset-btn'
            };
            const btnId = map[step.id];
            if (btnId) document.getElementById(btnId)?.click();
        }
    });
});

document.querySelectorAll('.toggle-password-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const input = document.getElementById(this.dataset.target);
        if (!input) return;
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        this.innerHTML = isPassword ?
            `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="m14.12 14.12a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>` :
            `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    });
});

// Recurrence modal listeners
document.getElementById('recurrence-select')?.addEventListener('change', function() {
    recurrence.type = this.value;
    if (recurrence.type === 'smart' && eventType !== 'task') {
        recurrence.type = 'none';
        this.value = 'none';
    }
    if ((this.value === 'weekly' || this.value === 'custom') && recurrence.days.length === 0) {
        const dayOfWeek = new Date().getDay();
        recurrence.days = [dayOfWeek];
    }
    if (this.value === 'none') {
        recurrence.days = [];
        recurrence.interval = 1;
    }
    updateRecurrenceModalUI();
});

document.addEventListener('click', function(e) {
    const btn = e.target.closest('.interval-btn');
    if (!btn) return;

    const spinner = btn.closest('.rec-interval-spinner');
    if (!spinner) return;

    const input = spinner.querySelector('.interval-input');
    if (input) {
        let val = parseInt(input.value, 10) || 1;
        const min = 1;
        if (btn.classList.contains('interval-plus')) {
            val += 1;
        } else if (btn.classList.contains('interval-minus')) {
            val = Math.max(min, val - 1);
        }
        input.value = val;
        input.dispatchEvent(new Event('input', {
            bubbles: true
        }));
    }

    const display = spinner.querySelector('.interval-display');
    if (display) {
        let val = parseInt(display.textContent, 10) || 1;
        const min = 1;
        if (btn.classList.contains('interval-plus')) {
            val += 1;
        } else if (btn.classList.contains('interval-minus')) {
            val = Math.max(min, val - 1);
        }
        display.textContent = val;
        recurrence.interval = val;
    }
});

document.getElementById('recurrence-done-btn')?.addEventListener('click', () => {
    const smartRadio = document.querySelector('input[name="smartInterval"]:checked');
    if (recurrence.type === 'smart' && smartRadio) {
        recurrence.smartInterval = smartRadio.value;
    }
    closeModal(document.getElementById('recurrence-modal'));
    updateRecurrencePreview();
});

document.getElementById('recurrence-modal-close')?.addEventListener('click', () => {
    closeModal(document.getElementById('recurrence-modal'));
    updateRecurrencePreview();
});
document.getElementById('recurrence-modal')?.addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal(this);
        updateRecurrencePreview();
    }
});
document.getElementById('open-recurrence-btn')?.addEventListener('click', openRecurrenceModal);

// --------- TAG MODAL (only colors) ---------
document.getElementById('tag-done-btn')?.addEventListener('click', () => {
    const colorBtn = document.getElementById('toggle-color-btn');
    if (colorBtn) {
        colorBtn.classList.toggle('active', selectedTagColor !== '#f5f5f5');
    }
    closeModal(document.getElementById('tag-modal'));
});

document.getElementById('tag-modal-close')?.addEventListener('click', () => {
    closeModal(document.getElementById('tag-modal'));
});
document.getElementById('tag-modal')?.addEventListener('click', function(e) {
    if (e.target === this) closeModal(this);
});

document.querySelector('.tag-colors-grid')?.addEventListener('click', function(e) {
    const item = e.target.closest('.tag-color-item');
    if (!item) return;
    selectedTagColor = item.dataset.color;
    document.querySelectorAll('.tag-color-item').forEach(el => el.classList.remove('selected'));
    item.classList.add('selected');
});

// --------- COLOR PICKER BUTTON ---------
document.getElementById('toggle-color-btn')?.addEventListener('click', function() {
    const btn = this;
    if (btn.classList.contains('active')) {
        selectedTagColor = '#f5f5f5';
        btn.classList.remove('active');
    } else {
        openModal(document.getElementById('tag-modal'));
        document.querySelectorAll('.tag-color-item').forEach(el => el.classList.remove('selected'));
        const activeColor = document.querySelector(`.tag-color-item[data-color="${selectedTagColor}"]`);
        if (activeColor) activeColor.classList.add('selected');
    }
});

// Gregorian picker listeners
if (gregPrevBtn) gregPrevBtn.addEventListener('click', function() {
    gregState.gm--;
    if (gregState.gm < 0) {
        gregState.gm = 11;
        gregState.gy--;
    }
    renderGregPicker();
});
if (gregNextBtn) gregNextBtn.addEventListener('click', function() {
    gregState.gm++;
    if (gregState.gm > 11) {
        gregState.gm = 0;
        gregState.gy++;
    }
    renderGregPicker();
});
if (gregConfirmBtn) gregConfirmBtn.addEventListener('click', function() {
    if (!gregState.selectedGd) {
        gregDaysEl.style.outline = '1px solid var(--accent)';
        return;
    }
    if (titlePickerActive) {
        titlePickerActive = false;
        var gy = gregState.gy,
            gm = gregState.gm,
            gd = gregState.selectedGd;
        var newDate = new Date(gy, gm, gd);
        if (viewMode === 'month') {
            newDate = new Date(newDate.getFullYear(), newDate.getMonth(), 1);
        } else if (viewMode === 'year') {
            newDate = new Date(newDate.getFullYear(), 0, 1);
        }
        currentDate = newDate;
        gregPickerPopup.classList.remove('open');
        document.getElementById('greg-today-btn').style.display = 'none';
        renderCalendar();
        return;
    }
    var h = gregHourInput.value || '09';
    var m = gregMinuteInput.value || '00';
    var gy = gregState.gy,
        gm = gregState.gm + 1,
        gd = gregState.selectedGd;
    if (eventStartGreg) eventStartGreg.value = gy + '-' + pad(gm) + '-' + pad(gd);
    if (eventStartInput) eventStartInput.value = gy + '-' + pad(gm) + '-' + pad(gd) + 'T' + pad(h) + ':' + pad(m);
    var endH = document.getElementById('greg-end-hour')?.value || '10';
    var endM = document.getElementById('greg-end-minute')?.value || '00';
    var endDateStr = gy + '-' + pad(gm) + '-' + pad(gd) + 'T' + pad(endH) + ':' + pad(endM);
    if (eventEndInput) eventEndInput.value = endDateStr;
    gregTriggerText.textContent = GREG_MONTH_NAMES[gregState.gm] + ' ' + gd + ', ' + gy + '  ' + pad(h) + ':' + pad(m);
    gregPickerTrigger.classList.add('has-value');
    gregPickerPopup.classList.remove('open');
});
if (gregPickerPopup) gregPickerPopup.addEventListener('click', function(e) {
    if (e.target === gregPickerPopup) {
        gregPickerPopup.classList.remove('open');
        document.getElementById('greg-today-btn').style.display = 'none';
        titlePickerActive = false;
    }
});
if (gregPickerTrigger) gregPickerTrigger.addEventListener('click', function() {
    if (eventStartGreg.value) {
        var p = eventStartGreg.value.split('-');
        openGregPicker(+p[0], +p[1] - 1, +p[2]);
    } else openGregPicker();
});

// Event type toggle
document.getElementById('event-type-toggle')?.addEventListener('click', e => {
    const label = e.target.closest('.event-type-label');
    if (label) setEventType(label.dataset.type);
});

// Navigation buttons
prevMonthBtn?.addEventListener('click', navigatePrev);
nextMonthBtn?.addEventListener('click', navigateNext);
currentMonthYearBtn?.addEventListener('click', openTitlePicker);

// Add event button
if (addEventBtn) addEventBtn.addEventListener('click', () => {
    if (!currentUser) {
        openModal(authOverlay);
        authError.textContent = 'Please sign in to add events.';
        return;
    }
    if (eventTitleInput) eventTitleInput.value = '';
    if (eventStartInput) eventStartInput.value = '';
    if (eventEndInput) eventEndInput.value = '';
    if (eventStartGreg) eventStartGreg.value = '';
    if (gregTriggerText) gregTriggerText.textContent = 'Select date';
    if (gregPickerTrigger) gregPickerTrigger.classList.remove('has-value');
    editingEventId = null;

    recurrence = {
        type: 'none',
        interval: 1,
        days: []
    };
    currentInvitees = [];
    updateRecurrencePreview();

    selectedTagColor = '#f5f5f5';
    currentLocationCoords = null;
    document.getElementById('location-coords-input').value = '';
    document.getElementById('location-section').style.display = 'none';
    document.getElementById('toggle-location-btn')?.classList.remove('active');
    document.getElementById('toggle-invite-btn')?.classList.remove('active');
    eventType = 'event';
    document.getElementById('event-type-toggle').style.display = '';
    const gregCheck = document.getElementById('event-all-day-greg');
    if (gregCheck) gregCheck.checked = false;

    const descField = document.getElementById('event-description');
    if (descField) descField.value = '';
    currentChecklistItems = [];
    hideInlineChecklist();
    const toggleBtn = document.getElementById('toggle-checklist-mode-btn');
    if (toggleBtn) {
        toggleBtn.style.display = 'none';
        toggleBtn.classList.remove('active');
    }

    updateAllDayAndTimeRows();
    openModal(eventModal);
    requestAnimationFrame(() => {
        setEventType('event');
    });
});

// Save event
if (saveEventBtn) saveEventBtn.onclick = saveEvent;

// Modal close buttons
closeModalBtns.forEach(btn => btn.addEventListener('click', () => closeModal(eventModal)));
eventDetailModal.addEventListener('click', e => {
    if (e.target === eventDetailModal) closeModal(eventDetailModal);
});
[eventModal].forEach(m => m?.addEventListener('click', e => {
    if (e.target === m) closeModal(m);
}));

// View tabs
viewTabsEl.querySelectorAll('.view-tab').forEach(btn => btn.addEventListener('click', () => {
    viewMode = btn.dataset.view;
    localStorage.setItem('ravlo-view-mode', viewMode);
    renderCalendar();
    animateTabIndicator();
}));

// Month/Year popup triggers
if (gregMonthBtn) gregMonthBtn.addEventListener('click', e => {
    e.stopPropagation();
    openGregMonthPopup();
});
if (gregYearBtn) gregYearBtn.addEventListener('click', e => {
    e.stopPropagation();
    openGregYearPopup();
});

if (confirmYesBtn) confirmYesBtn.addEventListener('click', async () => {
    var id = eventDetailConfirm.dataset.eventId;
    if (id) await deleteEventById(id);
    closeModal(eventDetailModal);
    hideDeleteConfirmation();
});
if (confirmNoBtn) confirmNoBtn.addEventListener('click', hideDeleteConfirmation);

// Time spinner
document.addEventListener('click', function(e) {
    const arrow = e.target.closest('.time-arrow');
    if (!arrow) return;

    const targetId = arrow.dataset.target;
    const step = parseInt(arrow.dataset.step, 10);
    const input = document.getElementById(targetId);
    if (!input) return;

    const prefix = 'greg';
    const isEnd = targetId.includes('end');

    let val = parseInt(input.value, 10);
    if (isNaN(val)) val = 0;
    let newVal = val + step;

    if (targetId.includes('hour')) {
        if (newVal < 0) newVal = 23;
        if (newVal > 23) newVal = 0;
    } else if (targetId.includes('minute')) {
        if (newVal < 0) newVal = 45;
        if (newVal > 45) newVal = 0;
        newVal = Math.round(newVal / 15) * 15;
    }

    const g = getSelectedGregFor(prefix);
    if (g && !isEnd && isToday(g.gy, g.gm, g.gd)) {
        const now = new Date();
        const curHour = now.getHours();
        const curMinute = now.getMinutes();
        const startHourEl = document.getElementById(prefix + '-hour');
        const startMinuteEl = document.getElementById(prefix + '-minute');
        let testHour = targetId.includes('hour') ? newVal : parseInt(startHourEl?.value || 0);
        let testMin = targetId.includes('minute') ? newVal : parseInt(startMinuteEl?.value || 0);
        const testTotal = testHour * 60 + testMin;
        const nowTotal = curHour * 60 + curMinute;
        if (testTotal <= nowTotal) return;
    }

    input.value = String(newVal).padStart(2, '0');

    if (!isEnd) syncEndTimeOnStartChange(prefix);

    const obj = {
        value: val
    };
    gsap.to(obj, {
        value: newVal,
        duration: 0.3,
        ease: 'power2.out',
        onUpdate: function() {
            input.value = String(Math.round(obj.value)).padStart(2, '0');
        }
    });

    gsap.fromTo(input, {
        scale: 1
    }, {
        scale: 1.1,
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
    });

    gsap.fromTo(arrow, {
        scale: 1
    }, {
        scale: 1.3,
        duration: 0.2,
        yoyo: true,
        repeat: 1,
        ease: 'power2.out'
    });

    validateTimeInput(prefix, isEnd);
});

// Time input validation listeners
['greg'].forEach(prefix => {
    const startHour = document.getElementById(prefix + '-hour');
    const startMin = document.getElementById(prefix + '-minute');
    const endHour = document.getElementById(prefix + '-end-hour');
    const endMin = document.getElementById(prefix + '-end-minute');

    if (startHour) {
        startHour.addEventListener('input', () => {
            validateTimeInput(prefix, false);
            syncEndTimeOnStartChange(prefix);
        });
        startHour.addEventListener('change', () => {
            validateTimeInput(prefix, false);
            syncEndTimeOnStartChange(prefix);
        });
    }
    if (startMin) {
        startMin.addEventListener('input', () => {
            validateTimeInput(prefix, false);
            syncEndTimeOnStartChange(prefix);
        });
        startMin.addEventListener('change', () => {
            validateTimeInput(prefix, false);
            syncEndTimeOnStartChange(prefix);
        });
    }
    if (endHour) {
        endHour.addEventListener('input', () => validateTimeInput(prefix, true));
        endHour.addEventListener('change', () => validateTimeInput(prefix, true));
    }
    if (endMin) {
        endMin.addEventListener('input', () => validateTimeInput(prefix, true));
        endMin.addEventListener('change', () => validateTimeInput(prefix, true));
    }
});

// All-day toggle
document.getElementById('event-all-day-greg')?.addEventListener('change', function() {
    const timeRow = document.querySelector('#greg-picker-popup .picker-time-row');
    if (timeRow) timeRow.style.display = this.checked ? 'none' : '';
});

// --------- ICON PICKER BUTTON ---------
function updateIconButton() {
    const btn = document.getElementById('toggle-icon-btn');
    if (!btn) return;
    if (selectedIcon) {
        btn.innerHTML = selectedIcon;
    } else {
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>`;
    }
}

function openIconModal() {
    const modal = document.getElementById('icon-modal');
    const grid = document.getElementById('icon-grid');
    if (!modal || !grid) return;

    grid.innerHTML = '';
    ICON_OPTIONS.forEach((iconObj) => {
        const item = document.createElement('div');
        item.className = 'icon-item';
        if (selectedIcon === iconObj.svg) {
            item.classList.add('selected');
        }
        item.innerHTML = iconObj.svg;
        item.addEventListener('click', () => {
            selectedIcon = iconObj.svg;
            updateIconButton();

            document.getElementById('toggle-icon-btn')?.classList.add('active');
            grid.querySelectorAll('.icon-item').forEach(el => el.classList.remove('selected'));
            item.classList.add('selected');
            selectedIcon = iconObj.svg;
            const iconBtn = document.getElementById('toggle-icon-btn');
            if (iconBtn) {
                iconBtn.classList.toggle('active', !!selectedIcon);
            }
            selectedIcon = ev.icon || null;

            selectedIcon = null;
            updateIconButton();
        });
        grid.appendChild(item);
    });

    openModal(modal);
}

document.getElementById('toggle-icon-btn')?.addEventListener('click', function() {
    const btn = this;
    if (btn.classList.contains('active')) {
        selectedIcon = null;
        updateIconButton();
        btn.classList.remove('active');
    } else {
        openIconModal();
    }
});

document.getElementById('icon-done-btn')?.addEventListener('click', () => {
    closeModal(document.getElementById('icon-modal'));
});

document.getElementById('icon-modal-close')?.addEventListener('click', () => {
    closeModal(document.getElementById('icon-modal'));
});

document.getElementById('icon-modal')?.addEventListener('click', function(e) {
    if (e.target === this) closeModal(this);
});

/* --------- INVITE MODAL HANDLERS (Connected to Dashboard Ecosystem) --------- */
document.getElementById('toggle-invite-btn')?.addEventListener('click', () => {
    const btn = document.getElementById('toggle-invite-btn');
    if (!currentUser) {
        alert('Please sign in first.');
        return;
    }
    if (btn && btn.classList.contains('active')) {
        currentInvitees = [];
        updateInviteSelectedUI();
        btn.classList.remove('active');
        closeModal(document.getElementById('invite-modal'));
    } else {
        if (!document.getElementById('invite-search-input')) {
            rebuildInviteModal();
        }
        document.getElementById('invite-search-input').value = '';
        document.getElementById('invite-search-results').innerHTML = '';
        document.getElementById('invite-link-section').style.display = 'none';
        document.getElementById('invite-selected-list').innerHTML = '';
        currentInvitees = [];
        updateInviteSelectedUI();
        openModal(document.getElementById('invite-modal'));
    }
});

function rebuildInviteModal() {
    const modal = document.getElementById('invite-modal');
    const content = modal.querySelector('.modal-content');
    const closeBtn = content.querySelector('#invite-modal-close')?.outerHTML || '';
    content.innerHTML = `
        ${closeBtn}
        <h3 class="modal-heading">Invite People</h3>
        <p style="font-size:12px; color:#aaa; margin-bottom:8px;">Only users with English names are searchable.</p>
        <input type="text" id="invite-search-input" class="auth-field" placeholder="Search by English name..." autocomplete="off">
        <div id="invite-search-results" class="invite-results"></div>
        <div id="invite-selected-list" class="invite-selected-list"></div>
        <div id="invite-link-section" style="display:none; margin-top:12px;">
            <p style="font-size:12px; color:#aaa; margin-bottom:4px;">Share this link to connect first:</p>
            <div style="display:flex; gap:8px; background:#111; padding:6px 10px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">
                <code id="invite-link-text" style="word-break:break-all;">XXXX</code>
                <button id="copy-invite-link-btn" class="icon-btn" title="Copy">📋</button>
            </div>
        </div>
        <button id="invite-done-btn" class="accent-btn" style="margin-top:16px;">Done</button>
    `;
    document.getElementById('invite-modal-close')?.addEventListener('click', () => closeModal(document.getElementById('invite-modal')));
    document.getElementById('invite-done-btn')?.addEventListener('click', () => {
        closeModal(document.getElementById('invite-modal'));
        document.getElementById('toggle-invite-btn')?.classList.add('active');
    });
    document.getElementById('copy-invite-link-btn')?.addEventListener('click', () => {
        const link = document.getElementById('invite-link-text').textContent;
        navigator.clipboard.writeText(link).then(() => alert('Link copied!'));
    });
    let searchTimeout;
    document.getElementById('invite-search-input').addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const q = this.value.trim();
        if (q.length < 2) {
            document.getElementById('invite-search-results').innerHTML = '';
            return;
        }
        searchTimeout = setTimeout(() => searchInviteUsers(q), 300);
    });
}

async function searchInviteUsers(query) {
    const resultsDiv = document.getElementById('invite-search-results');
    resultsDiv.innerHTML = '<div style="color:#aaa;">Searching...</div>';

    try {
        let {
            data: users,
            error
        } = await sb
            .from('profiles')
            .select('id, first_name, last_name, username, photo_url')
            .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,username.ilike.%${query}%`)
            .limit(10);
        if (error) throw error;

        users = users.filter(u => {
            const name = (u.first_name || '') + ' ' + (u.last_name || '');
            return /^[A-Za-z\s\-']+$/.test(name.trim());
        });

        if (!users || users.length === 0) {
            const inviteLink = generateInviteLinkForNewUser();
            resultsDiv.innerHTML = `
                <div class="invite-not-found">
                    <p class="invite-not-found-title">${escHtml(query)} isn't on Ravlo yet.</p>
                    <p class="invite-not-found-sub">Invite them by sharing this link:</p>
                    <div class="invite-link-box">
                        <code id="invite-nonuser-link" class="invite-nonuser-link">${escHtml(inviteLink)}</code>
                        <button id="copy-nonuser-invite-btn" class="copy-invite-link-btn" title="Copy link">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                    </div>
                </div>
            `;
            const copyBtn = document.getElementById('copy-nonuser-invite-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', copyNonUserInviteLink);
            }
            return;
        }

        const myId = currentUser.id;
        const userIds = users.map(u => u.id).filter(id => id !== myId);

        if (userIds.length === 0) {
            resultsDiv.innerHTML = '<div style="color:#aaa;">No users found.</div>';
            return;
        }

        const {
            data: allConns
        } = await sb
            .from('dashboard_connectionrequests')
            .select('from_id, to_id, status')
            .or(
                `and(from_id.eq.${myId},to_id.in.(${userIds.join(',')}),status.in.(accepted,pending)),` +
                `and(to_id.eq.${myId},from_id.in.(${userIds.join(',')}),status.in.(accepted,pending))`
            );

        const connectedMap = new Map();
        const pendingMap = new Map();
        allConns?.forEach(conn => {
            const otherId = conn.from_id === myId ? conn.to_id : conn.from_id;
            if (conn.status === 'accepted') connectedMap.set(otherId, true);
            else if (conn.status === 'pending') pendingMap.set(otherId, true);
        });

        resultsDiv.innerHTML = '';
        users.forEach(user => {
            if (user.id === myId) return;

            const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || 'User';
            const isConnected = connectedMap.has(user.id);
            const isPending = pendingMap.has(user.id) && !isConnected;
            const alreadyInvited = currentInvitees.some(inv => inv.id === user.id);

            let statusText = '';
            let actionButton = '';

            if (isConnected) {
                statusText = 'Connected';
                actionButton = alreadyInvited ?
                    '<span class="badge badge-accepted">Added</span>' :
                    `<button class="btn-accent" onclick="inviteConnectedUser('${user.id}', '${escHtml(name)}')">Invite</button>`;
            } else if (isPending) {
                statusText = 'Pending';
                actionButton = '<span class="badge badge-pending">Pending</span>';
            } else {
                statusText = 'Not connected';
                actionButton = alreadyInvited ?
                    '<span class="badge badge-accepted">Added</span>' :
                    `<button class="btn-ghost" onclick="sendConnectionInvite('${user.id}', '${escHtml(name)}')">Connect & Invite</button>`;
            }

            let avatarHtml = '';
            if (user.photo_url) {
                avatarHtml = `<img src="${escHtml(user.photo_url)}" alt="${escHtml(name)}" class="invite-avatar-img" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`;
                avatarHtml += `<div class="invite-avatar-fallback" style="display:none;">${name.charAt(0).toUpperCase()}</div>`;
            } else {
                avatarHtml = `<div class="invite-avatar-fallback">${name.charAt(0).toUpperCase()}</div>`;
            }

            const card = document.createElement('div');
            card.className = 'invite-user-card';
            card.innerHTML = `
                <div class="invite-user-info">
                    <div class="invite-avatar">${avatarHtml}</div>
                    <div class="invite-user-details">
                        <div class="invite-user-name">${escHtml(name)}</div>
                        <div class="invite-user-status">${statusText}</div>
                    </div>
                </div>
                ${actionButton}
            `;
            resultsDiv.appendChild(card);
        });

    } catch (e) {
        resultsDiv.innerHTML = `<div style="color:#f88;">Error: ${e.message}</div>`;
    }
}

function inviteConnectedUser(userId, name) {
    if (currentInvitees.some(inv => inv.id === userId)) return;
    currentInvitees.push({
        id: userId,
        name
    });
    updateInviteSelectedUI();
    document.getElementById('invite-search-input').dispatchEvent(new Event('input'));
}

async function sendConnectionInvite(userId, name) {
    try {
        // Check if there's already any request between these two users
        const {
            data: existing
        } = await sb
            .from('dashboard_connectionrequests')
            .select('id, status')
            .or(
                `and(from_id.eq.${currentUser.id},to_id.eq.${userId}),` +
                `and(from_id.eq.${userId},to_id.eq.${currentUser.id})`
            )
            .limit(1);

        if (existing && existing.length > 0) {
            const req = existing[0];
            if (req.status === 'accepted') {
                alert('You are already connected with this user.');
            } else if (req.status === 'pending') {
                alert('A connection request is already pending. Please wait for a response.');
            }
            return;
        }

        // Insert new request
        const {
            data: newReq,
            error
        } = await sb
            .from('dashboard_connectionrequests')
            .insert({
                from_id: currentUser.id,
                to_id: userId,
                status: 'pending'
            })
            .select()
            .single();
        if (error) throw error;

        const inviteLink = `${DASHBOARD_URL}?connect=${newReq.id}`;
        document.getElementById('invite-link-text').textContent = inviteLink;
        document.getElementById('invite-link-section').style.display = 'block';

        const myName = [currentProfile?.first_name, currentProfile?.last_name].filter(Boolean).join(' ') || 'Someone';
        await addNotificationToUser(userId, 'connection', 'New connection request',
            `${myName} wants to connect`, '#connections');

        showToast(`Connection request sent! Share the invite link with ${name}.`);
    } catch (e) {
        alert('Error: ' + e.message);
    }
}

function updateInviteSelectedUI() {
    const container = document.getElementById('invite-selected-list');
    container.innerHTML = currentInvitees.map(inv => `
        <div class="invite-selected-item">
            <span>${escHtml(inv.name)}</span>
            <button class="icon-btn" onclick="removeInvitee('${inv.id}')">✕</button>
        </div>
    `).join('');
}

function removeInvitee(id) {
    currentInvitees = currentInvitees.filter(inv => inv.id !== id);
    updateInviteSelectedUI();
    const inviteBtn = document.getElementById('toggle-invite-btn');
    if (inviteBtn && currentInvitees.length === 0) {
        inviteBtn.classList.remove('active');
    }
    document.getElementById('invite-search-input').dispatchEvent(new Event('input'));
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* --------- /* --------- LOCATION MODAL HANDLERS (with place name search) --------- */
let locationSearchTimer = null;

document.getElementById('toggle-location-btn')?.addEventListener('click', function() {
    const btn = this;
    if (btn.classList.contains('active')) {
        currentLocationCoords = null;
        currentLocationName = '';
        currentLocationAddress = null;
        document.getElementById('location-coords-input').value = '';
        if (locationMarker) {
            locationMap.removeLayer(locationMarker);
            locationMarker = null;
        }
        btn.classList.remove('active');
        closeModal(document.getElementById('location-modal'));
        return;
    }

    const searchInput = document.getElementById('location-search-input');
    const suggestions = document.getElementById('location-suggestions');
    const infoEl = document.getElementById('selected-location-info');

    searchInput.value = '';
    suggestions.innerHTML = '';
    suggestions.style.display = 'none';
    infoEl.textContent = '';

    if (currentLocationName && currentLocationCoords) {
        searchInput.value = currentLocationName;
        infoEl.textContent = `${currentLocationName} (${currentLocationCoords.lat.toFixed(5)}, ${currentLocationCoords.lng.toFixed(5)})`;
    } else if (currentLocationCoords) {
        infoEl.textContent = `${currentLocationCoords.lat.toFixed(5)}, ${currentLocationCoords.lng.toFixed(5)}`;
    }

    openModal(document.getElementById('location-modal'));

    setTimeout(() => {
        initLocationMap('location-modal-map');
        if (locationMap) {
            locationMap.invalidateSize();
            if (locationMarker) locationMap.removeLayer(locationMarker);
            if (currentLocationCoords) {
                updateMapFromCoords(currentLocationCoords.lat, currentLocationCoords.lng);
            }
        }
    }, 200);
});

// Place name search with debounce
document.getElementById('location-search-input')?.addEventListener('input', function() {
    clearTimeout(locationSearchTimer);
    const query = this.value.trim();
    const suggestionsList = document.getElementById('location-suggestions');

    if (query.length < 2) {
        suggestionsList.innerHTML = '';
        suggestionsList.style.display = 'none';
        return;
    }

    locationSearchTimer = setTimeout(async () => {
        try {
            // 1. Photon URL
            const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Server error: ${response.status}`);
            }

            const data = await response.json();

            suggestionsList.innerHTML = '';
            // 2. Data in features key
            if (!data.features || data.features.length === 0) {
                suggestionsList.innerHTML = '<li style="color:#888;">No results found</li>';
                suggestionsList.style.display = 'block';
                return;
            }

            // 3. Iterate features
            data.features.forEach(place => {
                const li = document.createElement('li');
                const props = place.properties;
                const mainName = props.name || props.street || 'Unnamed place';
                const city = props.city || props.state || '';
                const country = props.country || '';
                let shortAddress = [city, country].filter(Boolean).join(', ');

                li.innerHTML = `<span style="font-weight:600; color:#fff;">${mainName}</span>` +
                    (shortAddress ? `<br><span style="font-size:11px; color:#888;">${shortAddress}</span>` : '');

                // 4. Coordinates: [lng, lat] order
                const [lng, lat] = place.geometry.coordinates;

                li.addEventListener('click', () => {
                    document.getElementById('location-search-input').value = mainName;
                    document.getElementById('selected-location-info').textContent =
                        `${mainName} (${lat.toFixed(5)}, ${lng.toFixed(5)})`;

                    suggestionsList.innerHTML = '';
                    suggestionsList.style.display = 'none';

                    updateMapFromCoords(lat, lng);

                    currentLocationCoords = {
                        lat,
                        lng
                    };
                    currentLocationName = mainName;
                    currentLocationAddress = {
                        city: city,
                        country: country,
                    };
                });

                suggestionsList.appendChild(li);
            });

            suggestionsList.style.display = 'block';
        } catch (err) {
            console.error('Photon Geocoding error:', err);
            let errorMsg = 'Error fetching data. ';
            if (err.message.includes('Failed to fetch')) {
                errorMsg += 'Please check your internet connection.';
            } else {
                errorMsg += err.message;
            }
            suggestionsList.innerHTML = `<li style="color:#ff6b6b;">⚠️ ${errorMsg}</li>`;
            suggestionsList.style.display = 'block';
        }
    }, 300);
});

// Hide suggestions on outside click
document.addEventListener('click', (e) => {
    const suggestions = document.getElementById('location-suggestions');
    const searchInput = document.getElementById('location-search-input');
    if (suggestions && !suggestions.contains(e.target) && e.target !== searchInput) {
        suggestions.style.display = 'none';
    }
});

// Done button for location save
document.getElementById('location-done-btn')?.addEventListener('click', () => {
    if (currentLocationAddress) {
        // ... (existing address handling)
    } else if (currentLocationName) {
        // fallback
    } else if (currentLocationCoords) {
        // coordinates only
    } else {
        alert('Please select a location.');
        return;
    }

    closeModal(document.getElementById('location-modal'));
    document.getElementById('toggle-location-btn')?.classList.add('active');
});

document.getElementById('location-modal-close')?.addEventListener('click', () => {
    closeModal(document.getElementById('location-modal'));
});

/* --------- CHECKLIST MODAL HANDLERS --------- */
document.getElementById('toggle-checklist-mode-btn')?.addEventListener('click', function() {
    const btn = this;
    if (btn.classList.contains('active')) {
        hideInlineChecklist();
    } else {
        tempChecklistItems = JSON.parse(JSON.stringify(currentChecklistItems));
        renderChecklistModalItems();
        openModal(document.getElementById('checklist-modal'));
    }
});

document.getElementById('checklist-modal-add-btn')?.addEventListener('click', () => {
    const input = document.getElementById('checklist-modal-input');
    const text = input.value.trim();
    if (text) {
        tempChecklistItems.push({
            text,
            done: false
        });
        renderChecklistModalItems();
        input.value = '';
    }
});

document.getElementById('checklist-done-btn')?.addEventListener('click', () => {
    currentChecklistItems = tempChecklistItems;
    closeModal(document.getElementById('checklist-modal'));
    document.getElementById('toggle-checklist-mode-btn')?.classList.add('active');
});

document.getElementById('checklist-modal-close')?.addEventListener('click', () => {
    closeModal(document.getElementById('checklist-modal'));
});

// Copy invite code
document.getElementById('copy-invite-code-btn')?.addEventListener('click', () => {
    const code = document.getElementById('invite-code-text').textContent;
    navigator.clipboard.writeText(code).then(() => alert('Code copied!'));
});

// Clear location (old inline)
document.getElementById('clear-location-btn')?.addEventListener('click', function() {
    document.getElementById('location-coords-input').value = '';
    currentLocationCoords = null;
    currentLocationName = '';
    if (locationMarker) {
        locationMap.removeLayer(locationMarker);
        locationMarker = null;
    }
    document.getElementById('toggle-location-btn')?.classList.remove('active');
});

// Coordinate input (old one)
document.getElementById('location-coords-input')?.addEventListener('input', function() {
    const coords = parseCoordinates(this.value.trim());
    if (coords) {
        currentLocationCoords = coords;
        updateMapFromCoords(coords.lat, coords.lng);
    } else {
        currentLocationCoords = null;
    }
});

/* =========================== SIDEBAR OPEN/CLOSE =========================== */
(function() {
    const toggleBtn = document.getElementById('menu-toggle-btn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const closeBtn = document.getElementById('sidebar-close-btn');

    if (!toggleBtn || !sidebar || !overlay) return;

    let isOpen = false;

    function openSidebar() {
        if (isOpen) return;
        isOpen = true;
        toggleBtn.classList.add('open');
        overlay.classList.add('open');
        gsap.to(sidebar, {
            x: 0,
            duration: 0.5,
            ease: 'power3.out'
        });
    }

    function closeSidebar() {
        if (!isOpen) return;
        isOpen = false;
        toggleBtn.classList.remove('open');
        overlay.classList.remove('open');
        gsap.to(sidebar, {
            x: '-100%',
            duration: 0.4,
            ease: 'power3.in'
        });
    }

    toggleBtn.addEventListener('click', () => {
        isOpen ? closeSidebar() : openSidebar();
    });

    overlay.addEventListener('click', closeSidebar);
    if (closeBtn) {
        closeBtn.addEventListener('click', closeSidebar);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isOpen) {
            closeSidebar();
        }
    });

    sidebar.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', () => {
            setTimeout(closeSidebar, 150);
        });
    });
})();

async function cleanupOldCompletions() {
    if (!currentUser) return;
    const now = new Date();
    const twentyEightDaysMs = 28 * 24 * 60 * 60 * 1000;
    const twentyEightDaysAgo = new Date(now.getTime() - twentyEightDaysMs);

    for (let i = events.length - 1; i >= 0; i--) {
        const ev = events[i];

        // 1. رویدادهای تکرارشونده: فقط رکوردهای completion قدیمی را پاک کن
        if (ev.recurrence_type !== 'none') {
            if (ev.completed_timestamps && Object.keys(ev.completed_timestamps).length > 0) {
                let changed = false;
                for (let dateStr in ev.completed_timestamps) {
                    const completedAt = new Date(ev.completed_timestamps[dateStr]);
                    if (completedAt < twentyEightDaysAgo) {
                        if (ev.completed_occurrences) {
                            ev.completed_occurrences = ev.completed_occurrences.filter(d => d !== dateStr);
                        }
                        delete ev.completed_timestamps[dateStr];
                        changed = true;
                    }
                }
                if (changed) {
                    await updateEventInDB(ev.id, {
                        completed_occurrences: ev.completed_occurrences,
                        completed_timestamps: ev.completed_timestamps
                    });
                }
            }
            continue; // به هیچ عنوان خود رویداد حذف نشود
        }

        if (ev.start_date) {
            const startDate = new Date(ev.start_date);
            if (startDate < twentyEightDaysAgo) {
                await deleteEventFromDB(ev.id);
                events.splice(i, 1); // از آرایه محلی هم حذف کن
            }
        }
        // پاکسازی دعوت‌های ردشده که ۱ روز از ردشان گذشته (دلخواه)
await sb.from('ravlo')
    .delete()
    .eq('user_id', currentUser.id)
    .eq('invitation_status', 'declined')
    .lt('updated_at', new Date(Date.now() - 24*60*60*1000).toISOString()); // اگر ستون updated_at داری
    }
}

function copyNonUserInviteLink() {
    const linkEl = document.getElementById('invite-nonuser-link');
    if (!linkEl) return;
    const text = linkEl.textContent;

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Link copied to clipboard!');
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
        document.execCommand('copy');
        showToast('Link copied!');
    } catch (e) {
        alert('Could not copy link. Please copy it manually.');
    }
    document.body.removeChild(textarea);
}

/* =========================== INVITATION RESPONSE =========================== */
function openInvitationResponse(ev) {
    document.getElementById('invitation-response-title').textContent = 'Event Invitation';
    document.getElementById('invitation-response-message').textContent = 'You are invited to this event.';

    const container = document.getElementById('invitation-detail-container');
    container.innerHTML = '';

    // هدر جزئیات (رنگ + آیکون + عنوان)
    const headerDiv = document.createElement('div');
    headerDiv.className = 'invitation-detail-header';

    if (ev.color) {
        const colorDot = document.createElement('span');
        colorDot.className = 'detail-color-dot';
        colorDot.style.backgroundColor = ev.color;
        colorDot.style.width = '12px';
        colorDot.style.height = '12px';
        colorDot.style.borderRadius = '50%';
        colorDot.style.display = 'inline-block';
        headerDiv.appendChild(colorDot);
    }

    if (ev.icon) {
        const iconSpan = document.createElement('span');
        iconSpan.className = 'detail-icon';
        iconSpan.innerHTML = ev.icon;
        iconSpan.style.color = ev.color || 'var(--accent)';
        iconSpan.style.fontSize = '20px';
        headerDiv.appendChild(iconSpan);
    }

    const titleEl = document.createElement('h3');
    titleEl.textContent = ev.title || 'Untitled';
    titleEl.style.margin = '0';
    headerDiv.appendChild(titleEl);

    container.appendChild(headerDiv);

    // تاریخ و زمان
    const start = ev.start_date ? new Date(ev.start_date) : null;
    const end = ev.end_date ? new Date(ev.end_date) : null;
    let dateText = '',
        timeText = '';
    if (start) {
        dateText = start.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        if (ev.all_day) {
            timeText = 'All day';
        } else {
            const fmtTime = d => d.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
            timeText = fmtTime(start);
            if (end) timeText += ' - ' + fmtTime(end);
        }
    }
    const dateP = document.createElement('p');
    dateP.innerHTML = `<strong>Date:</strong> ${dateText}`;
    container.appendChild(dateP);
    const timeP = document.createElement('p');
    timeP.innerHTML = `<strong>Time:</strong> ${timeText}`;
    container.appendChild(timeP);

    // توضیحات
    if (ev.description && ev.description.trim()) {
        const descP = document.createElement('p');
        descP.innerHTML = `<strong>Description:</strong> ${ev.description}`;
        container.appendChild(descP);
    }

    // مهمان‌ها
    if (ev.invitees && ev.invitees.length > 0) {
        const inviteesP = document.createElement('p');
        inviteesP.innerHTML = `<strong>Invitees:</strong> ${ev.invitees.join(', ')}`;
        container.appendChild(inviteesP);
    }

    // مکان
    if (ev.location && ev.location.lat && ev.location.lng) {
        const locP = document.createElement('p');
        locP.innerHTML = `<strong>Location:</strong> ${ev.location.lat.toFixed(5)}, ${ev.location.lng.toFixed(5)}`;
        container.appendChild(locP);
    }

    openModal(document.getElementById('invitation-response-modal'));

    // دکمه Accept
    document.getElementById('invitation-accept-btn').onclick = async () => {
        showGlobalLoader();
        await updateEventInDB(ev.id, {
            invitation_status: 'accepted'
        });
        const localEv = events.find(e => e.id === ev.id);
        if (localEv) localEv.invitation_status = 'accepted';
        hideGlobalLoader();
        closeModal(document.getElementById('invitation-response-modal'));
        renderCalendar();
    };

    // دکمه Decline
    document.getElementById('invitation-decline-btn').onclick = async () => {
        showGlobalLoader();
        await deleteEventFromDB(ev.id);
        events = events.filter(e => e.id !== ev.id);

        if (ev.parent_event_id) {
            const {
                data: parentData
            } = await sb
                .from('ravlo')
                .select('user_id, title')
                .eq('id', ev.parent_event_id)
                .single();
            if (parentData) {
                await addNotificationToUser(
                    parentData.user_id,
                    'event',
                    'Invitation declined',
                    `${currentProfile?.first_name || 'Someone'} declined your invitation to "${parentData.title}"`,
                    '#'
                );
            }
        }
        hideGlobalLoader();
        closeModal(document.getElementById('invitation-response-modal'));
        renderCalendar();
    };

    document.getElementById('invitation-response-close').onclick = () => {
        closeModal(document.getElementById('invitation-response-modal'));
    };
    document.getElementById('invitation-response-modal').onclick = (e) => {
        if (e.target === document.getElementById('invitation-response-modal')) {
            closeModal(document.getElementById('invitation-response-modal'));
        }
    };
}

// =========================== RENDER CHECKLIST IN DETAIL ============================
function renderChecklistInDetail(ev) {
    const container = document.getElementById('detail-checklist-container');
    if (!container) return;

    // اگر تسک نباشه یا چک‌لیست نداشته باشه، مخفی کن
    if (ev.type !== 'task' || !ev.checklist || ev.checklist.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    
    // آیکون چک‌لیست رو همرنگ با تسک کن
    const icon = document.getElementById('detail-checklist-icon');
    if (icon) icon.style.color = ev.color || 'var(--accent)';

    const listContainer = document.getElementById('detail-checklist-items');
    listContainer.innerHTML = '';

    let allDone = true;

    // تابع بازگشتی برای رندر کردن آیتم‌ها و زیرآیتم‌ها
    function renderItems(items, parentElement, depth = 0) {
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'detail-checklist-row';
            if (depth > 0) {
                row.style.paddingLeft = (depth * 20) + 'px';
                row.classList.add('subtask-row');
            }

            // فقط چک‌باکس (بدون دکمه حذف)
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'neon-checkbox';
            cb.checked = item.done || false;
            cb.dataset.parentIndex = index;
            cb.dataset.depth = depth;

            // متن
            const textSpan = document.createElement('span');
            textSpan.className = 'detail-checklist-text';
            textSpan.textContent = item.text || 'Untitled';
            if (item.done) {
                textSpan.style.textDecoration = 'line-through';
                textSpan.style.opacity = '0.6';
            } else {
                allDone = false;
            }

            // فقط چک‌باکس و متن (بدون دکمه حذف)
            row.appendChild(cb);
            row.appendChild(textSpan);
            parentElement.appendChild(row);

            // اگر زیرآیتم‌ها داره
            if (item.subtasks && item.subtasks.length > 0) {
                const subContainer = document.createElement('div');
                subContainer.className = 'detail-checklist-subcontainer';
                renderItems(item.subtasks, subContainer, depth + 1);
                parentElement.appendChild(subContainer);
            }
        });
    }

    // رندر کردن آیتم‌ها
    renderItems(ev.checklist, listContainer, 0);

    // اگر همه آیتم‌ها Done بودند، تسک رو هم Done کن
    if (allDone && ev.checklist.length > 0) {
        markTaskDone(ev);
    }

    // رویدادهای چک‌باکس‌ها (بعد از رندر شدن)
    listContainer.querySelectorAll('.neon-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
            const depth = parseInt(this.dataset.depth);
            let item = null;

            if (depth === 0) {
                const idx = parseInt(this.dataset.parentIndex);
                if (idx >= 0 && idx < ev.checklist.length) {
                    item = ev.checklist[idx];
                }
            } else {
                // برای زیرآیتم‌ها: پیدا کردن آیتم
                let flatIdx = 0;
                let found = false;
                for (let i = 0; i < ev.checklist.length; i++) {
                    const p = ev.checklist[i];
                    if (p.subtasks) {
                        for (let s = 0; s < p.subtasks.length; s++) {
                            if (flatIdx === parseInt(this.dataset.parentIndex)) {
                                item = p.subtasks[s];
                                found = true;
                                break;
                            }
                            flatIdx++;
                        }
                    }
                    if (found) break;
                }
            }

            if (item) {
                item.done = this.checked;
                // به‌روزرسانی ظاهر متن
                const row = this.closest('.detail-checklist-row');
                if (row) {
                    const text = row.querySelector('.detail-checklist-text');
                    if (text) {
                        text.style.textDecoration = this.checked ? 'line-through' : 'none';
                        text.style.opacity = this.checked ? '0.6' : '1';
                    }
                }

                // ذخیره در دیتابیس
                updateEventInDB(ev.id, { checklist: ev.checklist })
                    .then(() => {
                        // بررسی همه آیتم‌ها
                        checkAllChecklistDone(ev);
                    })
                    .catch(() => alert('Error updating checklist.'));
            }
        });
    });

}
// =========================== CHECK ALL CHECKLIST DONE ============================
function checkAllChecklistDone(ev) {
    if (!ev.checklist || ev.checklist.length === 0) return;

    // بررسی همه آیتم‌ها (شامل زیرآیتم‌ها)
    function allItemsDone(items) {
        for (const item of items) {
            if (!item.done) return false;
            if (item.subtasks && item.subtasks.length > 0) {
                if (!allItemsDone(item.subtasks)) return false;
            }
        }
        return true;
    }

    if (allItemsDone(ev.checklist)) {
        markTaskDone(ev);
    }
}

// =========================== MARK TASK DONE ============================
function markTaskDone(ev) {
    // اگر از قبل done هست، کاری نکن
    if (ev.status === 'done') return;

    ev.status = 'done';
    ev.completed_at = new Date().toISOString();
    
    updateEventInDB(ev.id, { 
        status: 'done', 
        completed_at: ev.completed_at 
    }).then(() => {
        // به‌روزرسانی دکمه کامل در مودال
        const completeBtn = document.getElementById('detail-complete-btn');
        if (completeBtn) {
            completeBtn.textContent = 'Undo';
            completeBtn.onclick = () => {
                ev.status = 'pending';
                ev.completed_at = null;
                updateEventInDB(ev.id, { status: 'pending', completed_at: null })
                    .then(() => {
                        completeBtn.textContent = 'Done';
                        completeBtn.onclick = () => {
                            markTaskDone(ev);
                        };
                        // رفرش چک‌لیست
                        renderChecklistInDetail(ev);
                    });
            };
        }
        
        showToast('🎉 All tasks completed! Event marked as Done.');
        renderCalendar();
        updateNotificationDot();
    }).catch(() => alert('Error marking task as done.'));
}
/* =========================== POSTPONE =========================== */
function openPostponeModal() {
    if (!currentDetailEvent) return;
    document.getElementById('postpone-event-title').textContent =
        currentDetailEvent.title || 'Untitled';
    document.getElementById('postpone-custom-row').style.display = 'none';
    openModal(document.getElementById('postpone-modal'));
}

function applyPostponeOffset(minutes) {
    if (!currentDetailEvent) return;
    const ev = currentDetailEvent;
    const newStart = new Date(new Date(ev.start_date).getTime() + minutes * 60000);
    const payload = { start_date: newStart.toISOString() };

    if (ev.end_date) {
        const oldStart = new Date(ev.start_date);
        const oldEnd = new Date(ev.end_date);
        const duration = oldEnd.getTime() - oldStart.getTime();
        const newEnd = new Date(newStart.getTime() + duration);
        payload.end_date = newEnd.toISOString();
    }

    updateEventInDB(ev.id, payload)
        .then(() => {
            // به‌روزرسانی در آرایه محلی
            const localEv = events.find(e => e.id === ev.id);
            if (localEv) {
                if (payload.start_date) localEv.start_date = payload.start_date;
                if (payload.end_date) localEv.end_date = payload.end_date;
            }
            closeModal(document.getElementById('postpone-modal'));
            closeModal(document.getElementById('event-detail-modal'));
            renderCalendar();
        })
        .catch(err => alert('Postpone failed: ' + err.message));
}

// گوش‌دهندگان دکمه‌ها
document.getElementById('postpone-modal').addEventListener('click', function(e) {
    const optionBtn = e.target.closest('.postpone-option');
    if (!optionBtn) return;

    if (optionBtn.id === 'postpone-custom-btn') {
        document.getElementById('postpone-custom-row').style.display = 'block';
        return;
    }

    const offset = parseInt(optionBtn.dataset.offset);
    if (!isNaN(offset)) applyPostponeOffset(offset);
});

document.getElementById('postpone-custom-apply').addEventListener('click', function() {
    const mins = parseInt(document.getElementById('postpone-custom-input').value);
    if (isNaN(mins) || mins < 1) {
        alert('Please enter a valid number of minutes.');
        return;
    }
    applyPostponeOffset(mins);
});

document.getElementById('postpone-modal-close').addEventListener('click', () => {
    closeModal(document.getElementById('postpone-modal'));
});

/* =========================== INITIALIZATION =========================== */

async function initCalendar() {
    if (currentUser) {
        events = await fetchEvents();
        updateNotificationDot()
    } else {
        events = [];
    }
    renderCalendar();
    animateTabIndicator();
}

(async function tryRestoreSession() {
    showApp();

    async function applySessionUser(user) {
        currentUser = user;
        currentProfile = await buildCurrentProfile(user);
        currentUserRole = currentProfile?.role || 'user';
    }

    try {
        const {
            data: {
                session
            }
        } = await sb.auth.getSession();

        if (session?.user) {
            await applySessionUser(session.user);

            events = await fetchEvents();
            renderCalendar();
            updateAuthUI();
            await updateNotificationDot();
        } else {
            updateAuthUI();
        }
    } catch (e) {
        console.warn('Session restore failed:', e.message);
        updateAuthUI();
        await updateNotificationDot();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const accessToken = urlParams.get('access_token');
    const refreshToken = urlParams.get('refresh_token');

    if (accessToken && refreshToken) {
        const {
            error
        } = await sb.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
        });

        if (!error) {
            window.history.replaceState({}, document.title, window.location.pathname);

            const {
                data: {
                    user
                }
            } = await sb.auth.getUser();
            if (user) {
                await applySessionUser(user);
            }

            updateAuthUI();
            await initCalendar();
        } else {
            console.warn('URL session set failed:', error.message);
        }
    }

})();