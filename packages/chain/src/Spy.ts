import {Bool, Character, Experimental, Field, Provable, PublicKey, Struct, UInt64} from "o1js";
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

export class SpyInfoExtension extends Struct({
    blockHeight: UInt64,
    sender: PublicKey,
    senderNonce: UInt64,
}) {}

export class SpyMessageProofPublicInput extends Struct({
    securityKey: Field,
}) {}

export class SpyMessageProofPublicOutput extends Struct({}) {}

export const proveZkMessage = (
    publicInput: SpyMessageProofPublicInput,
    message: SpyMessage
): SpyMessageProofPublicOutput => {

    publicInput.securityKey.assertGreaterThan(10)
    publicInput.securityKey.assertLessThan(100)
    publicInput.securityKey.assertEquals(message.securityKey)

    return new SpyMessageProofPublicOutput({});
};

export const MessageZkProof = Experimental.ZkProgram({
    publicInput: SpyMessageProofPublicInput,
    publicOutput: SpyMessageProofPublicOutput,
    methods: {
        proveMessage: {
            privateInputs: [SpyMessage],
            method: proveZkMessage,
        },
    },
});

export class MessageProof extends Experimental.ZkProgram.Proof(MessageZkProof) {}


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
    public sendMessage(msgId: Field, agentId: Field,  messageProof: MessageProof) {
        let spyStatus = this.spyStatus.get(agentId).value;

        assert(
            spyStatus.isActive,
            'Agent not active'
        )
        assert(
            msgId.greaterThan(spyStatus.lastMsgId),
            'Message lifetime limit exceeded'
        )

        messageProof.verify()

        spyStatus.lastMsgId = msgId
        this.spyStatus.set(agentId, spyStatus)
    }
}

@runtimeModule()
export class SpyExtended extends Spy {
    @state() public additionalInfo = StateMap.from<Field, SpyInfoExtension>(
        Field,
        SpyInfoExtension
    );

    @runtimeMethod()
    public override sendMessage(
        agentId: Field,
        messageId: Field,
        messageProof: MessageProof
    ) {
        super.sendMessage(agentId, messageId, messageProof);

        let addInfo = this.additionalInfo.get(agentId).value;

        addInfo.blockHeight = this.network.block.height;
        addInfo.senderNonce = addInfo.senderNonce.add(1);
        addInfo.sender = this.transaction.sender.value;

        this.additionalInfo.set(agentId, addInfo);
    }
}

