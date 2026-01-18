/*
 * Copyright © 2016-2023 Jelurida IP B.V.
 * Copyright © 2023-2025 Jelurida Swiss SA
 *
 * See the LICENSE.txt file at the top-level directory of this distribution
 * for licensing information.
 *
 * Unless otherwise agreed in a custom licensing agreement with Jelurida
 * Swiss SA, no part of this software, including this file, may be copied,
 * modified, propagated, or distributed except according to the terms
 * contained in the LICENSE.txt file.
 *
 * Removal or modification of this copyright notice is prohibited.
 *
 */

package nxt.http.client;

import nxt.Constants;
import nxt.Tester;
import nxt.http.APICall;
import org.json.simple.JSONObject;

public class SetAssetPropertyBuilder {
    private final String secretPhrase;
    private final long assetId;
    private final String property;
    private final String value;
    private long feeNQT = 3 * Constants.ONE_NXT;

    public SetAssetPropertyBuilder(Tester setter, long assetId, String name, String value) {
        this.secretPhrase = setter.getSecretPhrase();
        this.assetId = assetId;
        this.property = name;
        this.value = value;
    }

    public SetAssetPropertyBuilder setFeeNQT(long feeNQT) {
        this.feeNQT = feeNQT;
        return this;
    }

    public JSONObject invokeNoError() {
        return build().invokeNoError();
    }

    private APICall build() {
        return new APICall.Builder("setAssetProperty")
                .param("secretPhrase", secretPhrase)
                .param("asset", Long.toUnsignedString(assetId))
                .param("feeNQT", feeNQT)
                .param("property", property)
                .param("value", value)
                .build();
    }
}
