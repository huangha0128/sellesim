import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { alipay } from '../utils/alipay';
import { config } from '../config';

const JWT_SECRET = config.jwt.secret;

export default (prisma: PrismaClient) => {
  const router = Router();

  router.post('/login', async (req: Request, res: Response) => {
    const { authCode } = req.body;

    if (!authCode) {
      return res.json({ code: 1, message: '缺少授权码' });
    }

    try {
      const params = alipay.buildParams('alipay.system.oauth.token', {}, {
        grant_type: 'authorization_code',
        code: authCode,
      });

      const result = await alipay.request(params);
      const tokenResponse = result.alipay_system_oauth_token_response;

      if (!tokenResponse || (tokenResponse.code && tokenResponse.code !== '10000') || !tokenResponse.access_token) {
        return res.json({ code: 1, message: '支付宝授权失败', detail: tokenResponse });
      }

      const alipayUserId = tokenResponse.alipay_user_id || tokenResponse.user_id || tokenResponse.open_id;
      const accessToken = tokenResponse.access_token;

      let user = await prisma.user.findUnique({ where: { alipayUserId } });

      if (!user) {
        let nickname = '支付宝用户';
        let avatar = '';

        try {
          const userInfoParams = alipay.buildParams('alipay.user.info.share', {}, {
            auth_token: accessToken,
          });

          const userInfoResult = await alipay.request(userInfoParams);
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
