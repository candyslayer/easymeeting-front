import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useMediaStore = defineStore('media', () => {
  const audioInputDevices = ref([])
  const audioOutputDevices = ref([])
  const videoInputDevices = ref([])

  const selectedAudioInputId = ref(localStorage.getItem('preferred_mic_id') || '')
  const selectedAudioOutputId = ref(localStorage.getItem('preferred_speaker_id') || '')
  const selectedVideoInputId = ref(localStorage.getItem('preferred_cam_id') || '')

  const isMicMuted = ref(false)
  const isCameraOff = ref(false)
  const isSharingScreen = ref(false)

  function setAudioInputDevices(devices) {
    audioInputDevices.value = devices
  }

  function setAudioOutputDevices(devices) {
    audioOutputDevices.value = devices
  }

  function setVideoInputDevices(devices) {
    videoInputDevices.value = devices
  }

  function setSelectedAudioInput(id) {
    selectedAudioInputId.value = id
    localStorage.setItem('preferred_mic_id', id)
  }

  function setSelectedAudioOutput(id) {
    selectedAudioOutputId.value = id
    localStorage.setItem('preferred_speaker_id', id)
  }

  function setSelectedVideoInput(id) {
    selectedVideoInputId.value = id
    localStorage.setItem('preferred_cam_id', id)
  }

  function setMicMuted(muted) {
    isMicMuted.value = muted
  }

  function setCameraOff(cameraOff) {
    isCameraOff.value = cameraOff
  }

  function setSharingScreen(sharing) {
    isSharingScreen.value = sharing
  }

  function resetMediaState() {
    isMicMuted.value = false
    isCameraOff.value = false
    isSharingScreen.value = false
  }

  return {
    audioInputDevices,
    audioOutputDevices,
    videoInputDevices,
    selectedAudioInputId,
    selectedAudioOutputId,
    selectedVideoInputId,
    isMicMuted,
    isCameraOff,
    isSharingScreen,
    setAudioInputDevices,
    setAudioOutputDevices,
    setVideoInputDevices,
    setSelectedAudioInput,
    setSelectedAudioOutput,
    setSelectedVideoInput,
    setMicMuted,
    setCameraOff,
    setSharingScreen,
    resetMediaState
  }
})

