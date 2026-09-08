import { Context } from '@koishijs/client'
import type {} from 'koishi-plugin-logger-logs'
import Logs from './index.vue'
import Settings from './settings.vue'
import './index.scss'
import './icons'

export default (ctx: Context) => {
    ctx.page({
        path: '/logs',
        name: '日志',
        icon: 'activity:logs',
        order: 0,
        authority: 4,
        fields: ['logs'],
        component: Logs,
    })

    ctx.slot({
        type: 'plugin-details',
        component: Settings,
        order: -800,
    })
}
