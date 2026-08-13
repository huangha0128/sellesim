export const config = {
  jwt: {
    // 生产环境通过环境变量 JWT_SECRET 注入，默认值仅用于本地开发
    secret: process.env.JWT_SECRET || 'your-jwt-secret-key-change-in-production',
    expiresIn: '30d',
  },

  alipay: {
    appId: '2021006186614108',
    privateKey: 'MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCfp5nPkZY5ryaHI9RLZuTQc90wwSl5w2sT7lyFwuDhWZHPVn6NatBmeEHGkhKuqAXDDcqr2uA4ousqxvEhqpX0vRpyB8+pPsRD1DHGmNcGRAzjeusb4mEAbAEpdx3dvy7J10gG4TZfDprk/weMIum5/1EW9HghIKQM6wilW4cm/s5/tQwcdUU4I1aLfj8Hqq6kIS3AgPdofkhwcdIyfGLXvjmub3mHBSmoKwPUaBfLGi+LWFrmC6j4AQHa58NThjCB2JMlKJZgybIXeodvGmZ8zl8Nv2jARTyuhtN/WqQvvboMfoNVeohZh8rMxZ7AguUfK32tANQ+yeTYRqsAeu11AgMBAAECggEAGZiaPT//ELJ2/9WLtKcDajQZMzbUunPNF/3wEXXj7d0ZVl9snKmSTctb6EUE/8FqYxIz+wd1ST89ardIc3hQ4FLtCXkdHuo0Nxeu/0MDvjpswo+zX94UZSfrq8UwIZwEGVINdyTmPakuxiXpBNuYEzzOuFprZAxCoNuRoEkjSunvsq3yllYDH5p3RVJ1erUFZi2o7jNN2/7eFBDbRFQmLddpA1gJxfsP0lDsBQqIkxu38GhFZZq7Z789z1TB7xi+Zm8sPE4ZOVEm6oQMU5RRozz9Xgp762tPG5y//CAc8eqLrV5LHXCRAfqQAHUqAGlhjkrCE4Hp0LWIYDofsxIY4QKBgQDnMuSK+/xw6fXmDeG6KjV3alNPuIh8vjgda5IsbkWUr+7GNUv48+G1qQqSCN1SxDEBhv+auQr0rTwB0fpJos12xgGrhIkuRie+OVW9AAzL/pk3o7oIspcCiX+lIJqqz0VwjLoXMse/1Ag7+yNkWJtbEULR1OJSpKEsSNUbQIcXfQKBgQCwx/yZGEVV4uKkkC8T24VXsvfrC5hiH2CmkvhenfOL2/9UzdRD7jfA9JuAolPvHRNamfDdRTGan9XY0W90YeKe52O9qOYG7W1Ld4t3rQusYzI9Y+717FHZASRtuK16xu+WLUsfg9kllNWKmnGPhas2ikI6GnCuOSFcWINsMmw/WQKBgDp6zAY/wNXKyBEd18fgH1AKS/JxSczLzKPcbsfgSKdYbPwjxQi+n4v0qyDPLzRdPcwWGpdHUPcczn3jX/y6OmBdq1R4HL7grfLWy9IXriT3TEgfmNHUYpAYuXnKKnUkIntajUOK662g80hAuO4L35gEYLN0tp6S19W8wnK3OrR9AoGALQXR9F+1EOmm1UiPZNxMuogvEeKzHZJmOCZIMTjDFUSjY8LEI8Tg2Diz/e/ZtpVOH44DRSdhOcMpYH3+h8KCR/wgb+Y7J1qCsmywzXr59R6SZgY0jtdwBPeAgp09OX6++B1y+4TF4gdk11b8QxRFBa/yq/+d4RFVyMIWPpEc9okCgYAXxTpD90GyT//u87TR5mRUYra36dAGkODi8gfRLW9k5WTtbRitdhixTufRngcoCcC4zUHWcYUAhx4kj9AMorjafaWJT+Gx9MTyL2rC4r8W0RnnjT7wx39xMvNz+YvGx7siGn42Ex0NET0jrKqTpyaWpeWWcbsPnFoTjSWXVo+2EQ==',
    gateway: 'https://openapi.alipay.com/gateway.do',
    signType: 'RSA2',
    charset: 'utf-8',
    version: '1.0',
  },
};
