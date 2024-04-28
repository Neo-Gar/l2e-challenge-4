import {Bool, Character, Field, Provable, Struct} from "o1js";
import {runtimeMethod, RuntimeModule, runtimeModule, state} from "@proto-kit/module";
import {assert, StateMap} from "@proto-kit/protocol";

const chars = 'qwertyuiopasdfghjklmnopqrstuvwxyz';

export class SpyMessage extends Struct({
    agentID: Field,
    message: Provable.Array(Character, 12),
    securityKey: Field,
}) {
    static randomize(
        agentID: Field,
        securityKey: Field
    ): SpyMessage {
        return new SpyMessage({
            agentID: agentID,
            message: [...Array(12)].map(() => {
                return Character.fromString(
                    chars[Math.floor(Math.random() * chars.length)]
                )
            }),
            securityKey: securityKey
        })
    }
}

export class SpyStatus extends Struct({
    isActive: Bool,
    lastMsgId: Field,
    securityKey: Field,
}) {}

interface SpyConfig {}

@runtimeModule()
export class Spy extends RuntimeModule<SpyConfig> {
    @state() public spyStatus = StateMap.from<Field, SpyStatus>(
        Field,
        SpyStatus
    )

    @runtimeMethod()
    public addSpy(id: Field, securityKey: Field) {
        assert(
            this.spyStatus.get(id).value.isActive.not(),
            'Spy id duplicate'
        )

        this.spyStatus.set(
            id,
            new SpyStatus({
                isActive: Bool(true),
                lastMsgId: Field.from(0),
                securityKey: securityKey,
            })
        )
    }

    @runtimeMethod()
    public sendMessage(msgId: Field, msg: SpyMessage) {
        let spyStatus = this.spyStatus.get(msg.agentID).value;
        assert(
            spyStatus.isActive,
            'Agent not active'
        )
        assert(
            spyStatus.securityKey.lessThan(100),
            'Invalid security key'
        )
        assert(
            spyStatus.securityKey.equals(msg.securityKey),
            'Security key does not match'
        )
        assert(
            msgId.greaterThan(spyStatus.lastMsgId),
            'Message lifetime limit exceeded'
        )

        spyStatus.lastMsgId = msgId
        this.spyStatus.set(msg.agentID, spyStatus)
    }
}

