/**
 * Wraps navigator.geolocation in a Promise.
 * @returns {Promise<{ latitude: number, longitude: number }>}
 */
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('GEOLOCATION_UNSUPPORTED'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('GEOLOCATION_DENIED'))
        } else if (error.code === error.TIMEOUT) {
          reject(new Error('GEOLOCATION_TIMEOUT'))
        } else {
          reject(new Error('GEOLOCATION_UNAVAILABLE'))
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
        ...options,
      },
    )
  })
}
