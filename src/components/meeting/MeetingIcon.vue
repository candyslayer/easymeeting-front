<template>
  <svg
    class="meeting-icon"
    :class="{ 'icon-spin': spin }"
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <template v-if="name === 'lock'">
      <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="12" cy="15" r="1.3" fill="currentColor" />
    </template>

    <template v-else-if="name === 'schedule'">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 7.5V12l3.2 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'network_check'">
      <path d="M3.5 16.5a11 11 0 0 1 17 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <path d="M6.8 18.8a7 7 0 0 1 10.4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <path d="M12 19l3.2-6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="12" cy="19.5" r="1.4" fill="currentColor" />
    </template>

    <template v-else-if="name === 'view_comfy'">
      <rect x="3.5" y="4.5" width="7.5" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.8" />
      <rect x="13" y="4.5" width="7.5" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.8" />
      <rect x="3.5" y="13" width="7.5" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.8" />
      <rect x="13" y="13" width="7.5" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.8" />
    </template>

    <template v-else-if="name === 'fullscreen'">
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'fullscreen_exit'">
      <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'call_end'">
      <path
        d="M3.5 14.2c4.8-4.2 12.2-4.2 17 0l-2.1 2.7a1.3 1.3 0 0 1-1.6.3l-2.3-1.2a1.2 1.2 0 0 1-.7-1.1v-1.2a10.2 10.2 0 0 0-3.6 0v1.2a1.2 1.2 0 0 1-.7 1.1l-2.3 1.2a1.3 1.3 0 0 1-1.6-.3L3.5 14.2Z"
        fill="currentColor"
      />
    </template>

    <template v-else-if="name === 'person'">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" stroke-width="1.8" />
      <path d="M5 19.5c.8-3.2 3.4-5 7-5s6.2 1.8 7 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'shield_with_heart'">
      <path d="M12 3L4.5 6.2v5.4c0 4.6 3.2 8.7 7.5 9.9 4.3-1.2 7.5-5.3 7.5-9.9V6.2L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M12 15.6s-3-1.9-3-4a1.7 1.7 0 0 1 3-1 1.7 1.7 0 0 1 3 1c0 2.1-3 4-3 4Z" fill="currentColor" />
    </template>

    <template v-else-if="name === 'hd'">
      <rect x="3" y="5" width="18" height="14" rx="2.2" stroke="currentColor" stroke-width="1.8" />
      <path d="M7 9v6M10.5 9v6M7 12h3.5M13.5 9h1.8a2.2 2.2 0 0 1 2.2 2.2v1.6a2.2 2.2 0 0 1-2.2 2.2h-1.8V9Z" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'slideshow'">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M10 9l5.5 3-5.5 3V9Z" fill="currentColor" />
    </template>

    <template v-else-if="name === 'open_in_full'">
      <path d="M15 4h5v5M20 4l-6.5 6.5M9 20H4v-5M4 20l6.5-6.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'picture_in_picture_alt'">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" stroke-width="1.8" />
      <rect x="11.5" y="10.5" width="7" height="5.5" rx="1" fill="currentColor" />
    </template>

    <template v-else-if="name === 'push_pin'">
      <path d="M9 4h6l-1 5 2.5 2.5V13H12.8v6.5L12 20.5l-.8-1V13H7.5v-1.5L10 9 9 4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'signal_cellular_alt'">
      <path d="M5 19v-4M10 19v-8M15 19V7M20 19V4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'auto_awesome'">
      <path d="M10 3l1.6 4.4L16 9l-4.4 1.6L10 15l-1.6-4.4L4 9l4.4-1.6L10 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      <path d="M18 14l.9 2.1L21 17l-2.1.9L18 20l-.9-2.1L15 17l2.1-.9L18 14Z" fill="currentColor" />
    </template>

    <template v-else-if="name === 'mic'">
      <rect x="9" y="3.5" width="6" height="10.5" rx="3" stroke="currentColor" stroke-width="1.8" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'mic_off'">
      <path d="M9 9.5V6.5a3 3 0 0 1 6 0v4.8M15 13.5a3 3 0 0 1-5.2 2M5.5 11.5a6.5 6.5 0 0 0 10.6 5M18.5 11.5c0 .9-.2 1.8-.5 2.6M12 18v3M9 21h6M3.5 3.5l17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'videocam'">
      <rect x="3" y="6.5" width="13" height="11" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M16 10l5-3v10l-5-3v-4Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'videocam_off'">
      <path d="M16 10l5-3v10l-3.2-1.9M8 6.5h6a2 2 0 0 1 2 2v3.5M14.8 17.5H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 1.4-1.9M3.5 3.5l17 17" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'noise_control_on'">
      <circle cx="12" cy="12" r="2.2" fill="currentColor" />
      <path d="M7.8 7.8a6 6 0 0 0 0 8.4M16.2 7.8a6 6 0 0 1 0 8.4M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'pan_tool'">
      <path d="M8 12.5V6.8a1.2 1.2 0 0 1 2.4 0V11M10.4 11V4.8a1.2 1.2 0 0 1 2.4 0V11M12.8 11V5.8a1.2 1.2 0 0 1 2.4 0V12M15.2 12V8.5a1.2 1.2 0 0 1 2.4 0V14a6 6 0 0 1-6 6H11a6 6 0 0 1-5.4-3.4l-1.9-3.9a1.2 1.2 0 0 1 2-1.2L8 14" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'neurology'">
      <path d="M9.5 4.5a3.5 3.5 0 0 0-3.3 4.6A3.2 3.2 0 0 0 5 14.5 3.5 3.5 0 0 0 8.5 19.5h2V4.5h-1ZM14.5 4.5a3.5 3.5 0 0 1 3.3 4.6 3.2 3.2 0 0 1 1.2 5.4 3.5 3.5 0 0 1-3.5 5h-2V4.5h1Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      <path d="M9 10h1.5M13.5 10H15M8.5 14.5h2M13.5 14.5h2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'verified'">
      <path d="M12 2.8l2.2 1.7 2.8-.2 1 2.6 2.5 1.3-.4 2.8 1.5 2.3-1.5 2.3.4 2.8-2.5 1.3-1 2.6-2.8-.2L12 21.2l-2.2-1.7-2.8.2-1-2.6-2.5-1.3.4-2.8L2.4 12l1.5-2.3-.4-2.8 2.5-1.3 1-2.6 2.8.2L12 2.8Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M9 12.2l2 2 4-4.2" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'check_circle'">
      <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8" />
      <path d="M8.5 12.2l2.4 2.4 4.8-4.8" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'sync'">
      <path d="M20 11a8 8 0 0 0-14.3-4.9M4 5v4h4M4 13a8 8 0 0 0 14.3 4.9M20 19v-4h-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'prompt_suggestion'">
      <path d="M5 6h9a4 4 0 0 1 4 4v5.5M14.5 12.5L18 16l3.5-3.5M4 19h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'bookmark_add'">
      <path d="M14 4H7a1.5 1.5 0 0 0-1.5 1.5V20l6-3.2 6 3.2V11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M18 3.5v5M15.5 6h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'fact_check'">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M6.5 9.5h4.5M6.5 12.5h4.5M6.5 15.5h3M13.5 12l2 2 3.5-4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'more_horiz'">
      <circle cx="6" cy="12" r="1.6" fill="currentColor" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <circle cx="18" cy="12" r="1.6" fill="currentColor" />
    </template>

    <template v-else-if="name === 'expand_less'">
      <path d="M7 14.5L12 9.5l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'screen_share'">
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M8 20h8M12 14V8.5M9.2 11L12 8.2l2.8 2.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'stop_screen_share'">
      <rect x="3" y="4.5" width="18" height="12.5" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M8 20h8M9.5 9.5l5 5M14.5 9.5l-5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'group'">
      <circle cx="9" cy="8.5" r="3" stroke="currentColor" stroke-width="1.8" />
      <path d="M3.5 18.5c.6-2.8 2.7-4.3 5.5-4.3s4.9 1.5 5.5 4.3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="16.5" cy="9.5" r="2.3" stroke="currentColor" stroke-width="1.7" />
      <path d="M16.5 14.5c2 0 3.7 1.2 4.2 3.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'radio_button_checked'">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" />
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
    </template>

    <template v-else-if="name === 'chat'">
      <path d="M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3.5V6.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
      <path d="M8.5 9.5h7M8.5 12.5h4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'settings'">
      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a1.9 1.9 0 0 1-2.7 2.7l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a1.9 1.9 0 0 1-3.8 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a1.9 1.9 0 0 1-2.7-2.7l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a1.9 1.9 0 0 1 0-3.8h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a1.9 1.9 0 0 1 2.7-2.7l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a1.9 1.9 0 0 1 3.8 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a1.9 1.9 0 0 1 2.7 2.7l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1H21a1.9 1.9 0 0 1 0 3.8h-.1a1.6 1.6 0 0 0-1.5 1Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'content_copy'">
      <rect x="8.5" y="8" width="11" height="12.5" rx="1.8" stroke="currentColor" stroke-width="1.8" />
      <path d="M15.5 8V5.8A1.8 1.8 0 0 0 13.7 4H6.3A1.8 1.8 0 0 0 4.5 5.8v10.4A1.8 1.8 0 0 0 6.3 18h2.2" stroke="currentColor" stroke-width="1.8" />
    </template>

    <template v-else-if="name === 'close'">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'shield'">
      <path d="M12 3L4.5 6.2v5.4c0 4.6 3.2 8.7 7.5 9.9 4.3-1.2 7.5-5.3 7.5-9.9V6.2L12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'stream'">
      <circle cx="12" cy="12" r="2.3" fill="currentColor" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9.2 9.2 0 0 0 0 13M18.5 5.5a9.2 9.2 0 0 1 0 13" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'smart_toy'">
      <rect x="4.5" y="7" width="15" height="11.5" rx="3" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 3.5V7M9 3.5h6M9 12.2h.01M15 12.2h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <path d="M9 15.5h6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'graphic_eq'">
      <path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'fit_screen'">
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <rect x="7.5" y="8" width="9" height="8" rx="1" stroke="currentColor" stroke-width="1.6" />
    </template>

    <template v-else-if="name === 'zoom_in'">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8" />
      <path d="M15.5 15.5L20 20M10.5 7.5v6M7.5 10.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'zoom_out'">
      <circle cx="10.5" cy="10.5" r="6.5" stroke="currentColor" stroke-width="1.8" />
      <path d="M15.5 15.5L20 20M7.5 10.5h6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'center_focus_strong'">
      <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.8" />
    </template>

    <template v-else-if="name === 'edit_note'">
      <path d="M4 7h11M4 11h11M4 15h6M14.5 18.5l4.8-4.8a1.2 1.2 0 0 1 1.7 1.7L16.2 20H14.5v-1.5Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'translate'">
      <path d="M4 6h8M8 4v2M10.5 6c-.5 3.3-2.5 6-5.5 7.5M6.5 9.5c1.1 1.6 2.5 2.8 4.2 3.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M13 20l3.5-9L20 20M14.2 17.5h4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'open_in_new'">
      <path d="M14 4h6v6M20 4l-9 9M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'keyboard_double_arrow_right'">
      <path d="M6.5 7l5 5-5 5M13 7l5 5-5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'keyboard_double_arrow_left'">
      <path d="M17.5 7l-5 5 5 5M11 7l-5 5 5 5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'send'">
      <path d="M3.5 11.5L20 4l-4 16-4.5-6-8-2.5ZM11.5 14L20 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'memory'">
      <rect x="6.5" y="6.5" width="11" height="11" rx="1.8" stroke="currentColor" stroke-width="1.8" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="0.8" fill="currentColor" />
      <path d="M9.5 3.5v3M14.5 3.5v3M9.5 17.5v3M14.5 17.5v3M3.5 9.5h3M3.5 14.5h3M17.5 9.5h3M17.5 14.5h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'present_to_all'">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M12 16V9.5M9 12.5L12 9.5l3 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'subtitles'">
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M6.5 12h4.5M13.5 12h4M6.5 15.5h7M15.5 15.5h2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'ios_share'">
      <path d="M12 14V4M8.5 7.5L12 4l3.5 3.5M6 11v7.5A1.5 1.5 0 0 0 7.5 20h9a1.5 1.5 0 0 0 1.5-1.5V11" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'account_tree'">
      <rect x="3.5" y="4.5" width="5.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.7" />
      <rect x="15" y="4.5" width="5.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.7" />
      <rect x="15" y="15" width="5.5" height="4.5" rx="1" stroke="currentColor" stroke-width="1.7" />
      <path d="M9 6.8h6M12 6.8v10.5h3" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'speed'">
      <path d="M4.5 15a8.5 8.5 0 1 1 15 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <path d="M12 13.5l4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      <circle cx="12" cy="14" r="1.6" fill="currentColor" />
    </template>

    <template v-else-if="name === 'hub'">
      <circle cx="12" cy="12" r="2.6" stroke="currentColor" stroke-width="1.8" />
      <circle cx="6" cy="6" r="1.8" stroke="currentColor" stroke-width="1.6" />
      <circle cx="18" cy="6" r="1.8" stroke="currentColor" stroke-width="1.6" />
      <circle cx="6" cy="18" r="1.8" stroke="currentColor" stroke-width="1.6" />
      <circle cx="18" cy="18" r="1.8" stroke="currentColor" stroke-width="1.6" />
      <path d="M7.5 7.5l2.7 2.7M16.5 7.5l-2.7 2.7M7.5 16.5l2.7-2.7M16.5 16.5l-2.7-2.7" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
    </template>

    <template v-else-if="name === 'how_to_vote'">
      <path d="M4 14.5l2.2-3.5h11.6l2.2 3.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-4.5ZM4 15h16" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
      <path d="M9.5 9.5l3-5 4 2.4-3 5-4-2.4Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'task_alt'">
      <path d="M20 12a8 8 0 1 1-4.5-7.2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      <path d="M9 12l2.4 2.4L19.5 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'terminal'">
      <rect x="3" y="4.5" width="18" height="15" rx="2" stroke="currentColor" stroke-width="1.8" />
      <path d="M7 9.5l3 2.5-3 2.5M12 14.5h5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'arrow_upward'">
      <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else-if="name === 'done'">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </template>

    <template v-else>
      <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.8" />
    </template>
  </svg>
</template>

<script setup>
defineProps({
  name: {
    type: String,
    required: true
  },
  size: {
    type: [Number, String],
    default: 18
  },
  spin: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.meeting-icon {
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
}

.icon-spin {
  animation: meeting-icon-spin 1.2s linear infinite;
}

@keyframes meeting-icon-spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
