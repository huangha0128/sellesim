import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import https from 'https';
import querystring from 'querystring';
import crypto from 'crypto';
import { config } from '../config';

const JWT_SECRET = config.jwt.secret;
const ALIPAY_APP_ID = config.alipay.appId;
const ALIPAY_PRIVATE_KEY = config.alipay.privateKey;

export default (prisma: PrismaClient) => {
  const router = Router();

  function sign(params: Record<string, string>): string {
    const sortedKeys = Object.keys(params).sort();
    const signContent = sortedKeys.map(key => `${key}=${params[key]}`).join('&');
    const sign = crypto.createSign('RSA2');
    sign.update(signContent);
    return sign.sign(ALIPAY_PRIVATE_KEY, 'base64');
  }

  function request(params: Record<string, string>): Promise<any> {
    return new Promise((resolve, reject) => {
      const signStr = sign(params);
      const postData = querystring.stringify({ ...params, sign: signStr });

      const options = {
        hostname: 'openapi.alipay.com',
        port: 443,
        path: '/gateway.do',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      });

      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  router.post('/login', async (req: Request, res: Response) => {
    const { authCode } = req.body;

    if (!authCode) {
      return res.json({ code: 1, message: '缺少授权码' });
    }

    try {
      const params = {
        app_id: ALIPAY_APP_ID,
        method: 'alipay.system.oauth.token',
        charset: 'utf-8',
        sign_type: 'RSA2',
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        version: '1.0',
        grant_type: 'authorization_code',
        code: authCode,
      };

      const result = await request(params);
      const tokenResponse = result.alipay_system_oauth_token_response;

      if (!tokenResponse || tokenResponse.code !== '10000') {
        return res.json({ code: 1, message: '支付宝授权失败', detail: tokenResponse });
      }

      const alipayUserId = tokenResponse.user_id;
      const accessToken = tokenResponse.access_token;

      let user = await prisma.user.findUnique({ where: { alipayUserId } });

      if (!user) {
        let nickname = '支付宝用户';
        let avatar = '';

        try {
          const userInfoParams = {
            app_id: ALIPAY_APP_ID,
            method: 'alipay.user.info.share',
            charset: 'utf-8',
            sign_type: 'RSA2',
            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
            version: '1.0',
            auth_token: accessToken,
          };

          const userInfoResult = await request(userInfoParams);
          const userInfo = userInfoResult.alipay_user_info_share_response?.user_info;

          if (userInfo) {
            nickname = userInfo.nick_name || nickname;
            avatar = userInfo.avatar || avatar;
          }
        } catch (e) {
          console.error('获取用户信息失败:', e);
        }

        user = await prisma.user.create({
          data: {
            alipayUserId,
            nickname,
            avatar,
          },
        });
      }

      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });

      res.json({
        code: 0,
        data: {
          token,
          user: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            email: user.email,
          },
        },
      });
    } catch (error) {
      console.error('登录失败:', error);
      res.json({ code: 1, message: '登录失败' });
    }
  });

  router.post('/update-profile', async (req: Request, res: Response) => {
    const { userId, nickname, avatar, email } = req.body;

    if (!userId) {
      return res.json({ code: 1, message: '缺少用户ID' });
    }

    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(nickname !== undefined && { nickname }),
          ...(avatar !== undefined && { avatar }),
          ...(email !== undefined && { email }),
        },
      });

      res.json({
        code: 0,
        data: {
          user: {
            id: user.id,
            nickname: user.nickname,
            avatar: user.avatar,
            email: user.email,
          },
        },
      });
    } catch (error) {
      console.error('更新用户信息失败:', error);
      res.json({ code: 1, message: '更新失败' });
    }
  });

  return router;
};
