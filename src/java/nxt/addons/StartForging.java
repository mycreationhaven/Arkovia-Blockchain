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

package nxt.addons;

import nxt.Generator;

import java.io.BufferedReader;
import java.io.IOException;

public final class StartForging extends StartAuto {

    @Override
    protected String getFilenameProperty() {
        return "nxt.startForgingFile";
    }

    @Override
    protected void processFile(BufferedReader reader) throws IOException {
        String line;
        while ((line = reader.readLine()) != null && !line.trim().isEmpty()) {
            Generator.startForging(line.trim());
        }
    }
}

